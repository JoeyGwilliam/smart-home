class MorrisonsError(Exception):
    """ Something went wrong using the Morrisons website that the caller can understand and act on: for example, the
    product to add can no longer be found, or the website no longer looks the way this server expects.

    The message says what happened and what to try, and is written to be read by the agent that called the tool.
    """
