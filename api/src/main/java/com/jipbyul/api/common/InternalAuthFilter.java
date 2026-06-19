package com.jipbyul.api.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * /internal/* 보호. X-Internal-Token 헤더가 설정된 토큰과 일치해야 통과.
 * 토큰 미설정이면 fail-closed(모두 403) — 운영 노출 사고 방지.
 * 스케줄 폴링은 HTTP를 거치지 않으므로 영향 없음.
 */
@Component
public class InternalAuthFilter extends OncePerRequestFilter {

    private static final String HEADER = "X-Internal-Token";
    private final String token;

    public InternalAuthFilter(@Value("${internal.api-token:}") String token) {
        this.token = token;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/internal/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (token == null || token.isBlank() || !token.equals(request.getHeader(HEADER))) {
            String traceId = UUID.randomUUID().toString();
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
            response.getWriter().write(
                    "{\"error\":{\"code\":\"UNAUTHORIZED\",\"message\":\"내부 전용 엔드포인트입니다.\",\"traceId\":\""
                            + traceId + "\"}}");
            return;
        }
        chain.doFilter(request, response);
    }
}
