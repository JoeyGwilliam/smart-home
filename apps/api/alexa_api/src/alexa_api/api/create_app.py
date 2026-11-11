import logging
import os
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Request, Response, status

from alexa_api.api.alexa_request_schema import AlexaRequestSchema
from alexa_api.api.alexa_response_schema import AlexaResponseSchema
from alexa_api.core.alexa_request_verifier import AlexaRequestVerifier, UnverifiedRequestError
from alexa_api.core.home_hub_skill import HomeHubSkill
from alexa_api.core.reminder_controls import ReminderControls
from alexa_api.core.reminders_client import RemindersClient
from alexa_api.core.site_editor_client import SiteEditorClient
from alexa_api.core.site_editor_controls import SiteEditorControls
from alexa_api.core.timer_controls import TimerControls
from alexa_api.core.timers_client import TimersClient

# uvicorn's logger is the one that already reaches the container's log.
_logger = logging.getLogger("uvicorn.error")


def create_app(skill: HomeHubSkill, verifier: AlexaRequestVerifier) -> FastAPI:
    """ Creates the Alexa API, which is the address that Alexa sends the skill's requests to.

    Unlike the home's other APIs, this one is reachable from the internet without a login, because Alexa can't log
    in. It protects itself instead: only requests that the verifier accepts reach the skill.

    Args:
        skill:
            Decides what to do and say for each request.
        verifier:
            Tells genuine requests from Alexa apart from everything else.

    Returns:
        The API, ready to be served.
    """
    # The pages that describe the API are left out: nothing uses them, and they would be public.
    app = FastAPI(title="Alexa API", openapi_url=None)
    app.state.skill = skill
    app.state.verifier = verifier
    app.include_router(_router)
    return app


def create_app_from_environment() -> FastAPI:
    """ Creates the Alexa API from environment variables.

    - `ALEXA_SKILL_ID`: the id that Amazon gave the skill. Requests for any other skill are refused.
    - `REMINDERS_API_URL`: address of the reminders API, such as `http://reminders-api:8000`.
    - `TIMERS_API_URL`: address of the timers API, such as `http://timers-api:8000`.
    - `SITE_EDITOR_API_URL`: address of the site editor API, such as `http://host.docker.internal:8002`.
    - `HOME_TIME_ZONE`: the time zone that people mean when they say a time, and that the home's clocks show, such as
      `Europe/London`.

    Returns:
        The API, ready to be served.

    Raises:
        KeyError: If a variable is not set. There are deliberately no defaults, so that a configuration mistake stops
            the server rather than leaving it refusing every request, or adding reminders at the wrong time.
        ZoneInfoNotFoundError: If the time zone doesn't exist.
    """
    home_time_zone = ZoneInfo(os.environ["HOME_TIME_ZONE"])
    skill = HomeHubSkill(
        ReminderControls(RemindersClient(os.environ["REMINDERS_API_URL"]), home_time_zone),
        TimerControls(TimersClient(os.environ["TIMERS_API_URL"]), home_time_zone),
        SiteEditorControls(SiteEditorClient(os.environ["SITE_EDITOR_API_URL"])),
    )
    return create_app(skill, AlexaRequestVerifier(os.environ["ALEXA_SKILL_ID"]))


async def _read_body(request: Request) -> bytes:
    # The signature covers the exact bytes that were sent, so the body can't be taken as already-parsed JSON.
    return await request.body()


_router = APIRouter()


@_router.post("/", response_model_exclude_none=True)
def respond_to_alexa(
        request: Request,
        body: Annotated[bytes, Depends(_read_body)],
        certificate_chain_url: Annotated[str, Header(alias="SignatureCertChainUrl")] = "",
        signature: Annotated[str, Header(alias="Signature-256")] = "",
) -> AlexaResponseSchema:
    try:
        request.app.state.verifier.verify(certificate_chain_url, signature, body)
    except UnverifiedRequestError as error:
        # Amazon asks for a 400 here. The reason is logged rather than returned, so that it helps when setting the
        # skill up without helping whoever sent the request.
        _logger.warning("Refused a request: %s", error)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The request couldn't be verified.") from error

    skill_request = AlexaRequestSchema.model_validate_json(body).to_skill_request()
    reply = request.app.state.skill.respond(skill_request)
    return AlexaResponseSchema.from_skill_reply(reply)


@_router.get("/health", status_code=status.HTTP_204_NO_CONTENT)
def check_health() -> Response:
    return Response(status_code=status.HTTP_204_NO_CONTENT)
