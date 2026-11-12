package com.nforce.retailops.security;

import com.nforce.retailops.entity.SuperAdmin;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Set;

public class SuperAdminUserDetails implements UserDetails {

    private final SuperAdmin superAdmin;

    public SuperAdminUserDetails(SuperAdmin superAdmin) {
        this.superAdmin = superAdmin;
    }

    public SuperAdmin getSuperAdmin() {
        return superAdmin;
    }

    @Override
    public Set<GrantedAuthority> getAuthorities() {
        return Set.of(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN"));
    }

    @Override
    public String getPassword() {
        return superAdmin.getPasswordHash();
    }

    @Override
    public String getUsername() {
        return superAdmin.getEmail();
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    // Mirrors AppUserDetails.isEnabled() deferring to user.isActive(). The JWT
    // filter re-loads the account on every request and drops the session when
    // this is false, so a deactivated Super Admin is cut off immediately.
    @Override
    public boolean isEnabled() {
        return superAdmin.isActive();
    }
}
