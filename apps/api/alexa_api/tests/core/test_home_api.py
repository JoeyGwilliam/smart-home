import httpx
import pytest

from alexa_api.core.home_api import HomeApi, HomeApiUnavailableError
from tests.fake_home_apis import create_failing_api


def test_sends_json_to_path_under_api_url_when_sending_request() -> None:
    received_requests: list[httpx.Request] = []

    def record_request(request: httpx.Request) -> httpx.Response:
        received_requests.append(request)
        return httpx.Response(201, json={"saved": True})

    api = HomeApi("reminders", "http://reminders-api:8000", httpx.MockTransport(record_request))

    response = api.send("POST", "/reminders", json={"title": "Buy milk"})

    assert response.json() == {"saved": True}
    assert received_requests[0].method == "POST"
    assert received_requests[0].url == "http://reminders-api:8000/reminders"
    assert received_requests[0].content == b'{"title":"Buy milk"}'


@pytest.mark.parametrize("status_code", [None, 404, 422, 500])
def test_raises_unavailable_error_with_spoken_name_when_request_fails(status_code: int | None) -> None:
    api = HomeApi("reminders", "http://reminders-api:8000", create_failing_api(status_code))

    with pytest.raises(HomeApiUnavailableError) as raised:
        api.send("GET", "/reminders")

    assert raised.value.spoken_name == "reminders"


def test_returns_response_when_error_status_is_an_expected_refusal() -> None:
    api = HomeApi("site editor", "http://site-editor:8002", create_failing_api(409))

    response = api.send("POST", "/change/messages", expected_refusals=(409,))

    assert response.status_code == 409
