import pytest

from recipes_api.core.recipe_picture import MAX_PICTURE_BYTES, RecipePicture


def test_raises_when_content_type_is_not_an_image_browsers_show() -> None:
    with pytest.raises(ValueError, match="JPEG, PNG, WebP or GIF"):
        RecipePicture(content=b"%PDF-1.7", content_type="application/pdf")


def test_raises_when_content_is_empty() -> None:
    with pytest.raises(ValueError, match="empty"):
        RecipePicture(content=b"", content_type="image/jpeg")


def test_raises_when_content_is_too_big() -> None:
    with pytest.raises(ValueError, match="10 MB"):
        RecipePicture(content=bytes(MAX_PICTURE_BYTES + 1), content_type="image/jpeg")


def test_accepts_content_when_it_is_exactly_the_biggest_allowed() -> None:
    picture = RecipePicture(content=bytes(MAX_PICTURE_BYTES), content_type="image/jpeg")

    assert len(picture.content) == MAX_PICTURE_BYTES


def test_leaves_bytes_out_when_represented() -> None:
    picture = RecipePicture(content=b"\xff\xd8\xff", content_type="image/jpeg")

    assert repr(picture).startswith("RecipePicture(content=<3 bytes>, content_type='image/jpeg'")
