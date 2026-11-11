from typing import Any, Self

from pydantic import BaseModel, Field

from alexa_api.core.skill_reply import SkillReply


class AlexaResponseSchema(BaseModel):
    """ The JSON that Alexa expects back from a skill.

    Attributes:
        response:
            What Alexa says, and whether it keeps listening afterwards.
        session_attributes:
            What Alexa sends back with the next request in the conversation.
        version:
            Version of Alexa's response format.
    """

    response: dict[str, Any]
    session_attributes: dict[str, str] = Field(serialization_alias="sessionAttributes")
    version: str = "1.0"

    @classmethod
    def from_skill_reply(cls, reply: SkillReply) -> Self:
        """ Creates the JSON representation of a skill reply.

        Args:
            reply:
                The reply to represent.

        Returns:
            The representation.
        """
        response: dict[str, Any] = {}
        if reply.speech is not None:
            response["outputSpeech"] = _represent_speech(reply.speech)
            response["shouldEndSession"] = reply.reprompt is None
        if reply.reprompt is not None:
            response["reprompt"] = {"outputSpeech": _represent_speech(reply.reprompt)}
        return cls(response=response, session_attributes=reply.conversation_memory)


def _represent_speech(speech: str) -> dict[str, str]:
    return {"type": "PlainText", "text": speech}
