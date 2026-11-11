from typing import Any

import httpx

# Alexa gives up on a skill after 8 seconds, so a slow API has to fail soon enough to still say so.
_TIMEOUT_SECONDS = 4


class HomeApiUnavailableError(Exception):
    """ One of the home's APIs couldn't be reached, or didn't do what was asked.

    Attributes:
        spoken_name:
            What to call the API when telling a person about the failure, such as "reminders".
    """

    def __init__(self, spoken_name: str, message: str) -> None:
        super().__init__(message)
        self.spoken_name = spoken_name


class HomeApi:
    """ One of the home's own APIs, such as the reminders API, as the skill reaches it.

    Every API fails in the same way from the skill's point of view, so this turns every failure into one error that
    the skill can tell the person about.
    """

    def __init__(self, spoken_name: str, url: str, transport: httpx.BaseTransport | None = None) -> None:
        """ Creates the connection to one API.

        Args:
            spoken_name:
                What to call the API when telling a person that it failed, such as "reminders".
            url:
                Address of the API, such as `http://reminders-api:8000`.
            transport:
                How requests are sent. Only tests need to set this, to stand in for the API.
        """
        self._spoken_name = spoken_name
        self._http_client = httpx.Client(base_url=url, timeout=_TIMEOUT_SECONDS, transport=transport)

    def send(self, method: str, path: str, json: Any = None, expected_refusals: tuple[int, ...] = ()) -> httpx.Response:
        """ Sends a request to the API.

        Args:
            method:
                The HTTP method, such as `GET`.
            path:
                The path within the API, such as `/reminders`.
            json:
                The request's body, which is sent as JSON. None to send no body.
            expected_refusals:
                Error statuses that mean something to the caller, which are returned rather than raised.

        Returns:
            The response, which is either a success or one of the expected refusals.

        Raises:
            HomeApiUnavailableError: If the API couldn't be reached, or answered with any other error status.
        """
        try:
            response = self._http_client.request(method, path, json=json)
            if response.status_code not in expected_refusals:
                response.raise_for_status()
            return response
        except httpx.HTTPError as error:
            # Every way that an API can fail leaves the person in the same position: what they asked for didn't
            # happen. One error lets the skill tell them so in one place.
            message = f"The {self._spoken_name} API failed to handle {method} {path}."
            raise HomeApiUnavailableError(self._spoken_name, message) from error
