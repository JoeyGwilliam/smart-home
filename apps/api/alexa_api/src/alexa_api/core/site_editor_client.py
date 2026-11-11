import httpx

from alexa_api.core.home_api import HomeApi

_BUSY_STATUS = 409


class SiteEditorBusyError(Exception):
    """ The site editor can't take a request at the moment, because it is in the middle of something. """


class SiteEditorClient:
    """ The site editor, which changes the home's site by asking Claude, reached through the site editor API.

    Every method raises `HomeApiUnavailableError` if the API couldn't be reached.
    """

    def __init__(self, site_editor_api_url: str, transport: httpx.BaseTransport | None = None) -> None:
        """ Creates a client for one site editor API.

        Args:
            site_editor_api_url:
                Address of the site editor API, such as `http://host.docker.internal:8002`.
            transport:
                How requests are sent. Only tests need to set this, to stand in for the API.
        """
        self._api = HomeApi("site editor", site_editor_api_url, transport)

    def request_change(self, request: str) -> None:
        """ Asks for a change to the site, as if it had been typed on the site editor page.

        The change is only started: Claude works on it afterwards, and it then waits on the site editor page to be
        previewed, and confirmed or discarded.

        Args:
            request:
                What the person wants, in their own words. Must contain non-whitespace text.

        Raises:
            SiteEditorBusyError: If the site editor is in the middle of something that a new request can't interrupt.
        """
        response = self._api.send("POST", "/change/messages", json={"text": request}, expected_refusals=(_BUSY_STATUS,))
        if response.status_code == _BUSY_STATUS:
            raise SiteEditorBusyError(response.text)

    def get_change_state(self) -> str:
        """ Finds out where the change to the site has got to.

        Returns:
            The site editor API's name for the state, such as `idle`, `working` or `reviewing`.
        """
        return self._api.send("GET", "/change").json()["state"]
