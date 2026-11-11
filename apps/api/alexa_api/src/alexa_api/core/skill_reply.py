from dataclasses import dataclass, field


@dataclass(frozen=True)
class SkillReply:
    """ What the skill does in answer to a request.

    Attributes:
        speech:
            What Alexa says. None to say nothing.
        reprompt:
            What Alexa says if the person stays silent, for a reply that asks them something. None ends the
            conversation after the speech.
        conversation_memory:
            What to remember until the person answers, which comes back with their next request. Forgotten once the
            conversation ends.
    """

    speech: str | None
    reprompt: str | None = None
    conversation_memory: dict[str, str] = field(default_factory=dict)
