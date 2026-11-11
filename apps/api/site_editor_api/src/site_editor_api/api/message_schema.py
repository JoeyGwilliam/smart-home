from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

from site_editor_api.core.claude_settings import ClaudeEffort, ClaudeModel, ClaudeSettings


class MessageSchema(BaseModel):
    """ The JSON representation of a message for Claude.

    Attributes:
        text:
            What the person wants, in their own words. Must contain non-whitespace text; whitespace around it is
            removed.
        model:
            The model that Claude should work on the message with, or None for Claude Code's default.
        effort:
            How hard Claude should think about the message, or None for the model's default.
    """
    model_config = ConfigDict(extra="forbid")

    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    model: ClaudeModel | None = None
    effort: ClaudeEffort | None = None

    def to_claude_settings(self) -> ClaudeSettings:
        """ Gathers how Claude should work on the message.

        Returns:
            The settings.
        """
        return ClaudeSettings(model=self.model, effort=self.effort)
