package com.nforce.retailops.config;

import com.nforce.retailops.security.StoreScopeInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final StoreScopeInterceptor storeScopeInterceptor;

    public WebMvcConfig(StoreScopeInterceptor storeScopeInterceptor) {
        this.storeScopeInterceptor = storeScopeInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(storeScopeInterceptor)
            .addPathPatterns("/api/**")
            // What the UI calls to recover from a revoked store: the session,
            // the profile, and the admin's store list.
            .excludePathPatterns("/api/auth/**", "/api/me", "/api/me/**", "/api/owner-stores");
    }
}
