"""All Pydantic request/response models used by the API."""
from typing import List, Optional
from pydantic import BaseModel, Field


class RegisterIn(BaseModel):
    phone: str
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=2, max_length=80)  # kept for backward compat = "Nome Cognome"
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    referral_code: Optional[str] = None


class LoginIn(BaseModel):
    phone: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class ArticleIn(BaseModel):
    title: str
    summary: str
    category: str
    source_url: Optional[str] = None
    image_url: Optional[str] = None
    is_premium: bool = False


class ArticlePatch(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    category: Optional[str] = None
    source_url: Optional[str] = None
    image_url: Optional[str] = None
    is_premium: Optional[bool] = None


class ArticleOut(BaseModel):
    id: str
    title: str
    summary: str
    category: str
    source_url: Optional[str] = None
    image_url: Optional[str] = None
    is_premium: bool
    views: int
    created_at: str


class MediaIn(BaseModel):
    title: str
    description: str = ""
    category: str
    kind: str  # "video" or "meditation"
    meditation_category: Optional[str] = None
    video_categories: Optional[List[str]] = None
    media_url: str
    thumbnail_url: Optional[str] = None
    duration_sec: Optional[int] = None
    is_premium: bool = False


class MediaOut(BaseModel):
    id: str
    title: str
    description: str
    category: str
    kind: str
    meditation_category: Optional[str] = None
    video_categories: Optional[List[str]] = None
    media_url: str
    thumbnail_url: Optional[str] = None
    duration_sec: Optional[int] = None
    is_premium: bool
    views: int
    created_at: str


class MediaUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    meditation_category: Optional[str] = None
    video_categories: Optional[List[str]] = None
    media_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    duration_sec: Optional[int] = None
    is_premium: Optional[bool] = None


class MessageIn(BaseModel):
    title: str
    body: str
    target_user_id: Optional[str] = None  # None = broadcast


class SummarizeIn(BaseModel):
    url: str
    category: str
    is_premium: bool = False


class CheckoutIn(BaseModel):
    plan: str  # only "12m" now
    coupon_code: Optional[str] = None
    email: Optional[str] = None


class CouponIn(BaseModel):
    code: str
    percent_off: int = Field(ge=1, le=100)
    max_uses: int = Field(ge=1, default=100)
    expires_at: Optional[str] = None
    scope: str = "any"  # "any" | "plan" | "course"
    course_id: Optional[str] = None


class FavoriteIn(BaseModel):
    content_id: str
    content_type: str  # "article" | "media"


class RegisterPushBody(BaseModel):
    user_id: str
    platform: str
    device_token: str


class CommentIn(BaseModel):
    content_id: str
    content_type: str  # "article" | "media"
    body: str = Field(min_length=1, max_length=1000)


class CompletionIn(BaseModel):
    content_id: str
    content_type: str  # "article" | "media"


class MarketingConsentIn(BaseModel):
    consent: bool


class SetEmailIn(BaseModel):
    email: str


class SetNameIn(BaseModel):
    first_name: str
    last_name: str


class CookieConsentIn(BaseModel):
    technical: bool = True
    analytics_first: bool = True
    analytics_third: bool = False
    marketing: bool = False


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=128)


class DeleteMeIn(BaseModel):
    current_password: str


class PasswordResetRequestIn(BaseModel):
    phone: str
    email: Optional[str] = None
    note: Optional[str] = Field(default=None, max_length=500)


class AdminResetPasswordIn(BaseModel):
    user_id: str
    new_password: str = Field(min_length=6, max_length=128)
    request_id: Optional[str] = None


class PushTokenIn(BaseModel):
    token: str
    platform: Optional[str] = None


class StripeCourseCheckoutIn(BaseModel):
    course_id: str
    coupon_code: Optional[str] = None
    email: Optional[str] = None


class YoutubeImportIn(BaseModel):
    channel_url: str
    category: str = "Video"
    is_premium: bool = False


class AdIn(BaseModel):
    image_url: str
    click_url: Optional[str] = None
    caption: Optional[str] = None
    is_active: bool = True


class PlaylistCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class PlaylistRename(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class PlaylistReorder(BaseModel):
    media_ids: List[str]


class PlaylistAddItem(BaseModel):
    media_id: str
