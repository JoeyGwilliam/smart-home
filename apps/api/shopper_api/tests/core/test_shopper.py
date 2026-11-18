import shutil
import threading
import time
from decimal import Decimal
from pathlib import Path

import pytest
from morrisons_mcp.core.morrisons_error import MorrisonsError
from morrisons_mcp.core.purchase_history import PastPurchase, PurchaseHistory
from morrisons_mcp.core.trolley import Trolley, TrolleyLine

from shopper_api.core.claude_settings import ClaudeSettings
from shopper_api.core.draft_order import DraftOrder, ItemChoice, ShoppingReport
from shopper_api.core.morrisons_account import AccountView
from shopper_api.core.progress_event import ProgressEvent, ProgressKind
from shopper_api.core.shopper import ActionNotAllowedError, Shopper, ShopperState, ShopperStatus
from shopper_api.core.shopping_failed_error import ShoppingFailedError
from shopper_api.core.shopping_list_item import ShoppingListItem

MILK = ShoppingListItem("Milk", 1, ())
NO_PURCHASE_HISTORY = PurchaseHistory(0, ())
MILK_REPORT = ShoppingReport("All found.", (ItemChoice("Milk", ("1 × Morrisons Milk 2L",), "Cheapest."),))
MILK_TROLLEY = Trolley(
    lines=(TrolleyLine("milk-id", "Morrisons Milk 2L", 1, Decimal("1.55"), None, None, None),),
    item_count=1,
    subtotal=Decimal("1.55"),
    savings=Decimal(0),
    total=Decimal("1.55"),
    minimum_spend=Decimal(25),
    shortfall_to_minimum_spend=Decimal("23.45"),
)


class FakeAccount:
    """ Has bought `purchase_history` in its past orders, or fails to read them with `purchase_history_failure`. """

    def __init__(
            self,
            is_logged_in_after_login: bool = True,
            purchase_history: PurchaseHistory = NO_PURCHASE_HISTORY,
            purchase_history_failure: str | None = None,
    ) -> None:
        self.calls: list[str] = []
        self.is_logged_in_after_login = is_logged_in_after_login
        self.purchase_history = purchase_history
        self.purchase_history_failure = purchase_history_failure

    def read_purchase_history(self, order_count: int) -> PurchaseHistory:
        self.calls.append(f"read_purchase_history({order_count})")
        if self.purchase_history_failure:
            raise MorrisonsError(self.purchase_history_failure)
        return self.purchase_history

    def empty_trolley(self) -> None:
        self.calls.append("empty_trolley")

    def view(self) -> AccountView:
        self.calls.append("view")
        return AccountView(is_logged_in=False, trolley=MILK_TROLLEY)

    def let_person_log_in(self) -> bool:
        return self.is_logged_in_after_login

    def log_out(self) -> None:
        self.calls.append("log_out")


class FakeAgent:
    """ Reports `report` straight away, or fails with `failure`, or, if `waits_to_be_stopped`, fails once stopped. """

    def __init__(self, account: FakeAccount, failure: str | None = None, waits_to_be_stopped: bool = False) -> None:
        self.account = account
        self.failure = failure
        self.waits_to_be_stopped = waits_to_be_stopped
        self.stopped = threading.Event()
        self.purchase_history: PurchaseHistory | None = None

    def shop(self, shopping_list, settings, purchase_history, record_progress) -> ShoppingReport:
        self.account.calls.append("shop")
        self.purchase_history = purchase_history
        record_progress(ProgressEvent(ProgressKind.ACTIVITY, "Searching for Milk"))
        if self.waits_to_be_stopped:
            self.stopped.wait(timeout=30)
            raise ShoppingFailedError("Stopped before Claude had finished.")
        if self.failure:
            raise ShoppingFailedError(self.failure)
        return MILK_REPORT

    def stop(self) -> None:
        self.stopped.set()


def create_shopper(
        tmp_path: Path,
        shopping_list: tuple[ShoppingListItem, ...] = (MILK,),
        account: FakeAccount | None = None,
        **agent_options,
) -> tuple[Shopper, FakeAccount]:
    """ Creates a shopper whose basket holds `shopping_list`, and that keeps its status in `tmp_path`. """
    account = account or FakeAccount()
    shopper = Shopper(lambda: shopping_list, account, FakeAgent(account, **agent_options), tmp_path / "status.json")
    return shopper, account


def wait_until_idle(shopper: Shopper) -> ShopperStatus:
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        status = shopper.get_status()
        if status.state is ShopperState.IDLE:
            return status
        time.sleep(0.01)
    raise TimeoutError("The shopper stayed busy.")


def wait_until_claude_is_shopping(shopper: Shopper) -> None:
    """ Waits for a trip to reach the stand-in for Claude, after which the shopper changes nothing until it is stopped. """
    deadline = time.monotonic() + 30
    while ProgressEvent(ProgressKind.ACTIVITY, "Searching for Milk") not in shopper.get_status().trip.events:
        if time.monotonic() > deadline:
            raise TimeoutError("Claude never started shopping.")
        time.sleep(0.01)


def test_is_idle_with_no_trip_when_nothing_has_been_done(tmp_path: Path) -> None:
    shopper, _ = create_shopper(tmp_path)

    assert shopper.get_status() == ShopperStatus(ShopperState.IDLE, is_logged_in=False, login_failure=None, trip=None)


def test_has_draft_order_of_trolley_read_back_when_trip_finishes(tmp_path: Path) -> None:
    shopper, _ = create_shopper(tmp_path)

    shopper.start_trip(ClaudeSettings())

    trip = wait_until_idle(shopper).trip
    assert trip.shopping_list == (MILK,)
    assert trip.draft_order == DraftOrder(MILK_REPORT, MILK_TROLLEY)


def test_reads_past_orders_then_empties_trolley_then_shops_then_reads_it_back_when_trip_runs(tmp_path: Path) -> None:
    shopper, account = create_shopper(tmp_path)

    shopper.start_trip(ClaudeSettings(past_order_count=3))

    wait_until_idle(shopper)
    assert account.calls == ["read_purchase_history(3)", "empty_trolley", "shop", "view"]


def test_gives_claude_purchase_history_and_records_it_when_household_has_past_orders(tmp_path: Path) -> None:
    purchase_history = PurchaseHistory(2, (PastPurchase("Heinz Baked Beans 4x415g", 2),))
    account = FakeAccount(purchase_history=purchase_history)
    agent = FakeAgent(account)
    shopper = Shopper(lambda: (MILK,), account, agent, tmp_path / "status.json")

    shopper.start_trip(ClaudeSettings(past_order_count=2))

    events = wait_until_idle(shopper).trip.events
    assert agent.purchase_history == purchase_history
    assert ProgressEvent(ProgressKind.ACTIVITY, "Claude will choose with your last 2 orders in mind") in events


def test_records_that_there_are_none_when_household_has_no_past_orders(tmp_path: Path) -> None:
    shopper, _ = create_shopper(tmp_path)

    shopper.start_trip(ClaudeSettings())

    events = wait_until_idle(shopper).trip.events
    assert ProgressEvent(ProgressKind.ACTIVITY, "There are no past Morrisons orders to learn from") in events


def test_does_not_read_past_orders_when_asked_to_learn_from_none(tmp_path: Path) -> None:
    shopper, account = create_shopper(tmp_path)

    shopper.start_trip(ClaudeSettings(past_order_count=0))

    wait_until_idle(shopper)
    assert account.calls == ["empty_trolley", "shop", "view"]


def test_shops_without_past_orders_and_says_why_when_they_cannot_be_read(tmp_path: Path) -> None:
    account = FakeAccount(purchase_history_failure="The website may have changed.")
    agent = FakeAgent(account)
    shopper = Shopper(lambda: (MILK,), account, agent, tmp_path / "status.json")

    shopper.start_trip(ClaudeSettings())

    trip = wait_until_idle(shopper).trip
    assert agent.purchase_history == NO_PURCHASE_HISTORY
    assert trip.draft_order == DraftOrder(MILK_REPORT, MILK_TROLLEY)
    assert ProgressEvent(
        ProgressKind.ACTIVITY,
        "Couldn't read your past Morrisons orders, so Claude is shopping without them. The website may have changed.",
    ) in trip.events


def test_records_claude_progress_when_trip_runs(tmp_path: Path) -> None:
    shopper, _ = create_shopper(tmp_path)

    shopper.start_trip(ClaudeSettings())

    assert ProgressEvent(ProgressKind.ACTIVITY, "Searching for Milk") in wait_until_idle(shopper).trip.events


def test_fails_without_shopping_when_shopping_list_is_empty(tmp_path: Path) -> None:
    shopper, account = create_shopper(tmp_path, shopping_list=())

    shopper.start_trip(ClaudeSettings())

    trip = wait_until_idle(shopper).trip
    assert trip.events[-1] == ProgressEvent(ProgressKind.FAILURE, "The shopping list is empty, so there is nothing to buy.")
    assert trip.draft_order is None
    assert account.calls == []


def test_records_failure_without_draft_order_when_claude_fails(tmp_path: Path) -> None:
    shopper, _ = create_shopper(tmp_path, failure="Usage limit reached.")

    shopper.start_trip(ClaudeSettings())

    trip = wait_until_idle(shopper).trip
    assert trip.events[-1] == ProgressEvent(ProgressKind.FAILURE, "Usage limit reached.")
    assert trip.draft_order is None


def test_refuses_to_start_trip_when_one_is_under_way(tmp_path: Path) -> None:
    shopper, _ = create_shopper(tmp_path, waits_to_be_stopped=True)
    shopper.start_trip(ClaudeSettings())

    with pytest.raises(ActionNotAllowedError):
        shopper.start_trip(ClaudeSettings())
    shopper.stop_trip()


def test_ends_trip_without_draft_order_when_stopped(tmp_path: Path) -> None:
    shopper, _ = create_shopper(tmp_path, waits_to_be_stopped=True)
    shopper.start_trip(ClaudeSettings())

    shopper.stop_trip()

    trip = wait_until_idle(shopper).trip
    assert trip.events[-1].kind is ProgressKind.FAILURE
    assert trip.draft_order is None


def test_keeps_draft_order_when_restarted(tmp_path: Path) -> None:
    shopper, _ = create_shopper(tmp_path)
    shopper.start_trip(ClaudeSettings())
    status_before_restart = wait_until_idle(shopper)

    restarted_shopper, _ = create_shopper(tmp_path)

    assert restarted_shopper.get_status() == status_before_restart


def test_ends_unfinished_trip_with_failure_when_restarted_part_of_the_way_through(tmp_path: Path) -> None:
    shopper, _ = create_shopper(tmp_path, waits_to_be_stopped=True)
    shopper.start_trip(ClaudeSettings())
    wait_until_claude_is_shopping(shopper)
    # The status is copied elsewhere, as the first shopper's thread can't be ended as a restart would end it.
    (tmp_path / "restarted").mkdir()
    shutil.copy(tmp_path / "status.json", tmp_path / "restarted" / "status.json")

    restarted_shopper, _ = create_shopper(tmp_path / "restarted")

    status = restarted_shopper.get_status()
    assert status.state is ShopperState.IDLE
    assert "restarted" in status.trip.events[-1].text
    shopper.stop_trip()


def test_is_logged_in_when_person_logs_in(tmp_path: Path) -> None:
    shopper, _ = create_shopper(tmp_path)

    shopper.log_in()

    assert wait_until_idle(shopper).is_logged_in


def test_explains_unfinished_login_when_person_closes_login_window_before_logging_in(tmp_path: Path) -> None:
    shopper, _ = create_shopper(tmp_path, account=FakeAccount(is_logged_in_after_login=False))

    shopper.log_in()

    status = wait_until_idle(shopper)
    assert not status.is_logged_in
    assert "hadn't finished logging you in" in status.login_failure


def test_forgets_login_when_logging_out(tmp_path: Path) -> None:
    shopper, account = create_shopper(tmp_path)
    shopper.log_in()
    wait_until_idle(shopper)

    shopper.log_out()

    assert not shopper.get_status().is_logged_in
    assert account.calls == ["log_out"]


def test_refuses_to_log_in_when_trip_is_under_way(tmp_path: Path) -> None:
    shopper, _ = create_shopper(tmp_path, waits_to_be_stopped=True)
    shopper.start_trip(ClaudeSettings())

    with pytest.raises(ActionNotAllowedError):
        shopper.log_in()
    shopper.stop_trip()
