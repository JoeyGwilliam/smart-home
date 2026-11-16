import os
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, FastAPI, Request, status
from fastapi.responses import JSONResponse
from morrisons_mcp.core.shop_settings import ShopSettings

from shopper_api.api.shopper_status_schema import ShopperStatusSchema
from shopper_api.api.trip_request_schema import TripRequestSchema
from shopper_api.core.morrisons_account import MorrisonsAccount
from shopper_api.core.shopper import ActionNotAllowedError, Shopper
from shopper_api.core.shopping_agent import ShoppingAgent
from shopper_api.core.shopping_api_client import fetch_shopping_list


def create_app(shopper: Shopper) -> FastAPI:
    """ Creates the shopper API, which fills the home's Morrisons trolley from its shopping list.

    Args:
        shopper:
            The shopper that does the work.

    Returns:
        The API, ready to be served.
    """
    app = FastAPI(title="Shopper API")
    app.state.shopper = shopper
    app.include_router(_router)
    app.add_exception_handler(ActionNotAllowedError, _explain_refusal)
    return app


def create_app_from_environment() -> FastAPI:
    """ Creates the shopper API from environment variables: `SHOPPING_API_URL`, where the shopping API is;
    `SHOPPER_STATE_DIRECTORY`, where the shopper keeps its status, which is created if it doesn't exist; and the
    `MORRISONS_` settings that `ShopSettings.from_environment` reads, which say where to deliver to.

    Returns:
        The API, ready to be served.

    Raises:
        KeyError: If `SHOPPING_API_URL` or `SHOPPER_STATE_DIRECTORY` is not set.
        ValueError: If a required `MORRISONS_` setting is not set.
    """
    state_directory = Path(os.environ["SHOPPER_STATE_DIRECTORY"])
    state_directory.mkdir(parents=True, exist_ok=True)
    shopping_api_url = os.environ["SHOPPING_API_URL"]
    shopper = Shopper(
        fetch_shopping_list=lambda: fetch_shopping_list(shopping_api_url),
        account=MorrisonsAccount(ShopSettings.from_environment()),
        # Claude Code runs in the state directory, which has no instructions of its own for it to follow.
        agent=ShoppingAgent(working_directory=state_directory),
        state_path=state_directory / "status.json",
    )
    return create_app(shopper)


def _explain_refusal(request: Request, error: ActionNotAllowedError) -> JSONResponse:
    return JSONResponse({"detail": str(error)}, status.HTTP_409_CONFLICT)


def _get_shopper(request: Request) -> Shopper:
    return request.app.state.shopper


_ShopperDependency = Annotated[Shopper, Depends(_get_shopper)]

# The actions answer straight away and do their work afterwards, so the status is what shows how they went.
_router = APIRouter()


@_router.get("/status")
def get_status(shopper: _ShopperDependency) -> ShopperStatusSchema:
    return ShopperStatusSchema.from_status(shopper.get_status())


@_router.post("/trip", status_code=status.HTTP_202_ACCEPTED)
def start_trip(trip_request: TripRequestSchema, shopper: _ShopperDependency) -> None:
    shopper.start_trip(trip_request.to_claude_settings())


@_router.post("/trip/stop", status_code=status.HTTP_204_NO_CONTENT)
def stop_trip(shopper: _ShopperDependency) -> None:
    shopper.stop_trip()


@_router.post("/account/log-in", status_code=status.HTTP_202_ACCEPTED)
def log_in(shopper: _ShopperDependency) -> None:
    shopper.log_in()


@_router.post("/account/log-out", status_code=status.HTTP_204_NO_CONTENT)
def log_out(shopper: _ShopperDependency) -> None:
    shopper.log_out()
