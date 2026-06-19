package com.jipbyul.api.announcement.dto;

import java.util.List;

public record AnnouncementListResponse(List<AnnouncementSummary> items, int page, int size, long totalCount) {}
