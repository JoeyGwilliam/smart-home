from alexa_api.core.skill_reply import SkillReply, ask


def test_keeps_listening_and_remembers_the_question_when_asking() -> None:
    reply = ask("When is it due?")

    assert reply == SkillReply(
        "When is it due?",
        reprompt="When is it due?",
        conversation_memory={"question": "When is it due?"},
    )


def test_remembers_other_things_alongside_the_question_when_asking_with_things_to_remember() -> None:
    reply = ask("When is it due?", {"new_reminder_title": "Buy milk"})

    assert reply.conversation_memory == {"new_reminder_title": "Buy milk", "question": "When is it due?"}


def test_says_preamble_once_before_the_question_when_asking_with_preamble() -> None:
    reply = ask("When is it due?", preamble="Sorry, I didn't catch that. ")

    assert reply.speech == "Sorry, I didn't catch that. When is it due?"
    assert reply.reprompt == "When is it due?"
    assert reply.conversation_memory == {"question": "When is it due?"}


def test_replaces_remembered_question_when_asking_a_new_one_with_old_memory() -> None:
    reply = ask("Delete Buy milk?", {"question": "When is it due?"})

    assert reply.conversation_memory == {"question": "Delete Buy milk?"}
