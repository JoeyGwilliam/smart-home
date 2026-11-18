import os
import threading
from collections.abc import Callable
from dataclasses import dataclass, replace
from enum import StrEnum
from pathlib import Path

from morrisons_mcp.core.morrisons_error import MorrisonsError
from morrisons_mcp.core.purchase_history import PurchaseHistory
from pydantic import TypeAdapter

from .claude_settings import ClaudeSettings
from .draft_order import DraftOrder
from .morrisons_account import MorrisonsAccount
from .progress_event import ProgressEvent, ProgressKind
from .shopping_agent import ShoppingAgent
from .shopping_failed_error import ShoppingFailedError
from .shopping_list_item import ShoppingListItem


class ShopperState(StrEnum):
    """ What the shopper is doing, which decides what can be asked of it.

    - `IDLE`: nothing. A shop can be started, or a person can log in or out.
    - `SHOPPING`: Claude is filling the trolley. It can be stopped.
    - `LOGGING_IN`: a window is open on the home server for a person to log in to Morrisons.
    """

    IDLE = "idle"
    SHOPPING = "shopping"
    LOGGING_IN = "logging_in"


@dataclass(frozen=True)
class ShoppingTrip:
    """ One go at filling the Morrisons trolley from the home's shopping list.

    Attributes:
        shopping_list:
            What was to be bought, as it was when the shop started. Empty until it has been read.
        claude_settings:
            How Claude was asked to shop.
        events:
            Everything that has happened during the shop, oldest first. If it failed, the last says why.
        draft_order:
            The filled trolley, ready to check and order, or None until the shop has finished, or if it failed.
    """

    shopping_list: tuple[ShoppingListItem, ...]
    claude_settings: ClaudeSettings
    events: tuple[ProgressEvent, ...]
    draft_order: DraftOrder | None


@dataclass(frozen=True)
class ShopperStatus:
    """ The shopper as it stands at one moment.

    Attributes:
        state:
            What the shopper is doing.
        is_logged_in:
            Whether shops fill a Morrisons account's trolley, which its owner can see and order from anywhere, as of
            when that was last found out. Otherwise they fill a guest's trolley, which only exists on the home server.
        login_failure:
            Why the last attempt to log in went wrong, for the person to read, or None if it didn't.
        trip:
            The latest shop, which stays until the next one starts, or None if there has never been one.
    """

    state: ShopperState
    is_logged_in: bool
    login_failure: str | None
    trip: ShoppingTrip | None


class ActionNotAllowedError(Exception):
    """ The shopper is not in a state that allows what was asked. The message says why, for the person to read. """


_STATUS_ADAPTER = TypeAdapter(ShopperStatus)

_UNFINISHED_LOGIN = (
    "Morrisons hadn't finished logging you in when the window was closed. Try again. If Morrisons asks you anything "
    "after your password, such as about 2-step verification, answer it, and close the window only once the Morrisons "
    "shop shows you as logged in."
)


class Shopper:
    """ Fills the home's Morrisons trolley from its shopping list, by having Claude shop, so that a person only has to
    check it and order. Nothing here can order anything.

    A shop reads what the household bought in its latest Morrisons orders, for Claude to learn its tastes from, empties
    the trolley, has Claude fill it, and then reads the trolley back, so that what is shown is what Morrisons holds
    rather than what Claude says it did. Shops fill a guest's trolley, which has no past orders, unless a person logs in.

    Actions return straight away and do their work in the background; `get_status` shows how far it has got. The
    status survives a restart of this process.
    """

    def __init__(
            self,
            fetch_shopping_list: Callable[[], tuple[ShoppingListItem, ...]],
            account: MorrisonsAccount,
            agent: ShoppingAgent,
            state_path: Path,
    ) -> None:
        """ Picks up the status from when the shopper last ran, if it has run before.

        Args:
            fetch_shopping_list:
                Gives everything that the home's basket adds up to buying. Raises ShoppingFailedError if it can't.
            account:
                The Morrisons trolley to fill, and its login.
            agent:
                Claude, which does the shopping.
            state_path:
                Where to keep the status between runs. The file is created when first needed; its directory must exist.
        """
        self._fetch_shopping_list = fetch_shopping_list
        self._account = account
        self._agent = agent
        self._state_path = state_path

        # Guards the status and `_was_stopped`, which requests read while a background thread changes them.
        self._lock = threading.RLock()
        self._status = ShopperStatus(ShopperState.IDLE, is_logged_in=False, login_failure=None, trip=None)
        self._was_stopped = False

        self._load_status()

    def get_status(self) -> ShopperStatus:
        """ Describes the shopper as it stands right now.

        Returns:
            A snapshot, which later progress does not alter.
        """
        with self._lock:
            return self._status

    def start_trip(self, claude_settings: ClaudeSettings) -> None:
        """ Starts a shop for the shopping list as it is now, in the background. Whatever is in the trolley is taken
        out first. Once it has finished, the trip has a draft order.

        Args:
            claude_settings:
                How Claude should shop.

        Raises:
            ActionNotAllowedError: If the shopper is busy.
        """
        with self._lock:
            self._require_idle()
            self._was_stopped = False
            starting_event = ProgressEvent(ProgressKind.ACTIVITY, "Reading the shopping list")
            trip = ShoppingTrip(shopping_list=(), claude_settings=claude_settings, events=(starting_event,), draft_order=None)
            self._update(state=ShopperState.SHOPPING, trip=trip)

        self._run_in_background(lambda: self._shop(claude_settings), on_failure=self._end_trip_with_failure)

    def stop_trip(self) -> None:
        """ Interrupts the shop in progress, which then fails. Does nothing unless the shopper is `SHOPPING`. The
        trolley keeps whatever had been added.
        """
        with self._lock:
            if self._status.state is not ShopperState.SHOPPING:
                return
            self._was_stopped = True
        self._agent.stop()

    def log_in(self) -> None:
        """ Opens a window on the home server's screen, in the background, for a person to log in to their Morrisons
        account. Every shop after that fills the account's own trolley.

        Raises:
            ActionNotAllowedError: If the shopper is busy.
        """
        with self._lock:
            self._require_idle()
            self._update(state=ShopperState.LOGGING_IN, login_failure=None)

        def log_in_then_finish() -> None:
            is_logged_in = self._account.let_person_log_in()
            login_failure = None if is_logged_in else _UNFINISHED_LOGIN
            self._update(state=ShopperState.IDLE, is_logged_in=is_logged_in, login_failure=login_failure)

        def report_login_failure(reason: str) -> None:
            self._update(state=ShopperState.IDLE, login_failure=reason)

        self._run_in_background(log_in_then_finish, on_failure=report_login_failure)

    def log_out(self) -> None:
        """ Forgets the Morrisons login, so that later shops fill a guest's trolley.

        Raises:
            ActionNotAllowedError: If the shopper is busy.
        """
        with self._lock:
            self._require_idle()
            self._account.log_out()
            self._update(is_logged_in=False, login_failure=None)

    def _shop(self, claude_settings: ClaudeSettings) -> None:
        shopping_list = self._fetch_shopping_list()
        if not shopping_list:
            raise ShoppingFailedError("The shopping list is empty, so there is nothing to buy.")
        with self._lock:
            self._update(trip=replace(self._status.trip, shopping_list=shopping_list))

        purchase_history = self._read_purchase_history(claude_settings.past_order_count)

        self._record_unless_stopped("Emptying the Morrisons trolley")
        self._account.empty_trolley()

        self._record_unless_stopped("Claude is shopping")
        report = self._agent.shop(shopping_list, claude_settings, purchase_history, self._record)

        self._record_unless_stopped("Reading the trolley back from Morrisons")
        account_view = self._account.view()

        with self._lock:
            self._record(ProgressEvent(ProgressKind.ACTIVITY, "The order is ready to check. Nothing has been ordered."))
            trip = replace(self._status.trip, draft_order=DraftOrder(report, account_view.trolley))
            self._update(state=ShopperState.IDLE, is_logged_in=account_view.is_logged_in, trip=trip)

    def _read_purchase_history(self, order_count: int) -> PurchaseHistory:
        """ Reads what the household bought in its latest Morrisons orders, for Claude to learn from, and records how
        that went. A shop goes ahead without them if they can't be read, as they only help Claude choose.
        """
        if order_count == 0:
            return PurchaseHistory(0, ())

        self._record_unless_stopped(f"Reading your last {_count_orders(order_count)} from Morrisons")
        try:
            purchase_history = self._account.read_purchase_history(order_count)
        except MorrisonsError as error:
            # Past orders only help Claude choose, so a change to the website that stops them being read shouldn't
            # stop the shop. The person is told, so that they know why Claude may choose differently.
            self._record(ProgressEvent(
                ProgressKind.ACTIVITY, f"Couldn't read your past Morrisons orders, so Claude is shopping without them. {error}",
            ))
            return PurchaseHistory(0, ())

        if purchase_history.order_count == 0:
            self._record(ProgressEvent(ProgressKind.ACTIVITY, "There are no past Morrisons orders to learn from"))
        else:
            past_orders = _count_orders(purchase_history.order_count)
            self._record(ProgressEvent(ProgressKind.ACTIVITY, f"Claude will choose with your last {past_orders} in mind"))
        return purchase_history

    def _record_unless_stopped(self, activity: str) -> None:
        """ Records the next step of a shop, unless the shop has been stopped, in which case it ends here. """
        with self._lock:
            if self._was_stopped:
                raise ShoppingFailedError("Stopped. The trolley holds whatever had been added by then.")
            self._record(ProgressEvent(ProgressKind.ACTIVITY, activity))

    def _end_trip_with_failure(self, reason: str) -> None:
        with self._lock:
            self._record(ProgressEvent(ProgressKind.FAILURE, reason))
            self._update(state=ShopperState.IDLE)

    def _run_in_background(self, job: Callable[[], None], on_failure: Callable[[str], None]) -> None:
        def run_job() -> None:
            try:
                job()
            except ShoppingFailedError as error:
                on_failure(str(error))
            except Exception as error:
                # Nothing is waiting for a background job, so its failure can only be reported in the status. Every
                # kind is caught, because a job that died silently would leave the shopper busy forever.
                on_failure(f"Something went wrong.\n{error}")

        # A daemon thread doesn't hold up a shutdown of the process.
        threading.Thread(target=run_job, daemon=True).start()

    def _require_idle(self) -> None:
        if self._status.state is ShopperState.SHOPPING:
            raise ActionNotAllowedError("A shop is already under way. Wait for it to finish, or stop it.")
        if self._status.state is ShopperState.LOGGING_IN:
            raise ActionNotAllowedError("The Morrisons login window is open on the home server. Close it first.")

    def _record(self, event: ProgressEvent) -> None:
        with self._lock:
            trip = self._status.trip
            self._update(trip=replace(trip, events=(*trip.events, event)))

    def _update(self, **changes: object) -> None:
        """ Changes some of the status, and saves it. """
        with self._lock:
            self._status = replace(self._status, **changes)
            # Written beside the file and then swapped in, so that a crash part of the way through can't leave half a
            # file.
            unfinished_path = self._state_path.with_name(f"{self._state_path.name}.unfinished")
            unfinished_path.write_bytes(_STATUS_ADAPTER.dump_json(self._status))
            os.replace(unfinished_path, self._state_path)

    def _load_status(self) -> None:
        if not self._state_path.exists():
            return

        self._status = _STATUS_ADAPTER.validate_json(self._state_path.read_bytes())
        if self._status.state is ShopperState.SHOPPING:
            # Whatever was running died with the last process.
            self._end_trip_with_failure("The shopper restarted part of the way through, so the shop didn't finish.")
        elif self._status.state is ShopperState.LOGGING_IN:
            self._update(state=ShopperState.IDLE, login_failure="The shopper restarted while the login window was open.")


def _count_orders(order_count: int) -> str:
    """ Words a number of orders, such as "order" for one or "3 orders". """
    return "order" if order_count == 1 else f"{order_count} orders"
