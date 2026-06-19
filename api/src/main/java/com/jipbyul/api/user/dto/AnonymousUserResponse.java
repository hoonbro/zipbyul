package com.jipbyul.api.user.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AnonymousUserResponse(UUID anonymousId, String status, OffsetDateTime createdAt) {}
