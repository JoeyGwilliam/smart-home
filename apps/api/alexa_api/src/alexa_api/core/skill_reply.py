from dataclasses import dataclass, field

# Where a reply that asks a question keeps the question, so that it can be asked again if the answer isn't understood.
QUESTION_MEMORY_KEY = "question"


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


def ask(question: str, things_to_remember: dict[str, str] | None = None, preamble: str = "") -> SkillReply:
    """ Creates a reply that asks the person a question and waits for their answer.

    Args:
        question:
            The question, which is asked again if the person stays silent or their answer isn't understood.
        things_to_remember:
            What the skill needs to know when the answer arrives, which comes back with it. Defaults to nothing.
        preamble:
            Something to say before the question, such as an apology. Must end with a space.

    Returns:
        The reply, whose conversation memory holds the question along with the things to remember.
    """
    memory = (things_to_remember or {}) | {QUESTION_MEMORY_KEY: question}
    return SkillReply(f"{preamble}{question}", reprompt=question, conversation_memory=memory)
