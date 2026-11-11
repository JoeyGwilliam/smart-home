import os
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, FastAPI, Query, Request, status
from fastapi.responses import HTMLResponse, JSONResponse

from site_editor_api.api.change_schema import ChangeSchema
from site_editor_api.api.commit_schema import CommitSchema
from site_editor_api.api.message_schema import MessageSchema
from site_editor_api.api.rescue_page import RESCUE_PAGE
from site_editor_api.core.site_checkout import SiteCheckout
from site_editor_api.core.site_editor import ActionNotAllowedError, SiteEditor


def create_app(site_checkout: SiteCheckout, site_editor: SiteEditor) -> FastAPI:
    """ Creates the site editor API, which changes one site.

    Args:
        site_checkout:
            The repository that the site is built from.
        site_editor:
            The editor that makes changes in that repository.

    Returns:
        The API, ready to be served.
    """
    app = FastAPI(title="Site editor API")
    app.state.site_checkout = site_checkout
    app.state.site_editor = site_editor
    app.include_router(_change_router)
    app.include_router(_history_router)
    app.include_router(_rescue_router)
    app.add_exception_handler(ActionNotAllowedError, _explain_refusal)
    return app


def create_app_from_environment() -> FastAPI:
    """ Creates the site editor API, for the repository named by the `SITE_EDITOR_REPOSITORY_PATH` environment
    variable. The conversation is kept in the file named by `SITE_EDITOR_STATE_PATH`, whose directory is created if
    it doesn't exist.

    Returns:
        The API, ready to be served.

    Raises:
        KeyError: If either environment variable is not set. There are deliberately no defaults, so that a
            configuration mistake stops the server rather than letting Claude loose on the wrong directory.
    """
    site_checkout = SiteCheckout(Path(os.environ["SITE_EDITOR_REPOSITORY_PATH"]))
    state_path = Path(os.environ["SITE_EDITOR_STATE_PATH"])
    state_path.parent.mkdir(parents=True, exist_ok=True)
    return create_app(site_checkout, SiteEditor(site_checkout, state_path))


def _explain_refusal(request: Request, error: ActionNotAllowedError) -> JSONResponse:
    return JSONResponse({"detail": str(error)}, status.HTTP_409_CONFLICT)


def _get_editor(request: Request) -> SiteEditor:
    return request.app.state.site_editor


def _get_checkout(request: Request) -> SiteCheckout:
    return request.app.state.site_checkout


_EditorDependency = Annotated[SiteEditor, Depends(_get_editor)]
_CheckoutDependency = Annotated[SiteCheckout, Depends(_get_checkout)]

# The one change that is being made to the site. There is always exactly one, which is idle between changes. The
# actions on it answer straight away and do their work afterwards, so its state is what shows how they went.
_change_router = APIRouter(prefix="/change", tags=["change"])


@_change_router.get("")
def get_change(editor: _EditorDependency) -> ChangeSchema:
    return ChangeSchema.from_change(editor.get_change())


@_change_router.post("/messages", status_code=status.HTTP_202_ACCEPTED)
def send_message(message_schema: MessageSchema, editor: _EditorDependency) -> None:
    editor.send_message(message_schema.text, message_schema.to_claude_settings())


@_change_router.post("/stop", status_code=status.HTTP_204_NO_CONTENT)
def stop_claude(editor: _EditorDependency) -> None:
    editor.stop_claude()


@_change_router.post("/confirm", status_code=status.HTTP_202_ACCEPTED)
def confirm_change(editor: _EditorDependency) -> None:
    editor.confirm_change()


@_change_router.post("/discard", status_code=status.HTTP_202_ACCEPTED)
def discard_change(editor: _EditorDependency) -> None:
    editor.discard_change()


_history_router = APIRouter(tags=["history"])


@_history_router.get("/commits")
def list_commits(checkout: _CheckoutDependency, limit: Annotated[int, Query(ge=1, le=200)] = 30) -> list[CommitSchema]:
    return [CommitSchema.from_commit(commit) for commit in checkout.list_commits(limit)]


# Discards a change when the site's own editor page can't, because the change broke the site.
_rescue_router = APIRouter(tags=["rescue"])


@_rescue_router.get("/rescue", response_class=HTMLResponse)
def show_rescue_page() -> str:
    return RESCUE_PAGE
