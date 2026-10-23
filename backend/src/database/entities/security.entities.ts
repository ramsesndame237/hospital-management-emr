/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';


@Entity({ name: 'rbac_application' })
export class RbacApplication {
  @PrimaryGeneratedColumn({ name: 'application_id' })
  ApplicationId!: number;

  @Column({ name: 'application_code', type: 'text', nullable: true })
  ApplicationCode!: string | null;

  @Column({ name: 'application_name', type: 'text', nullable: true })
  ApplicationName!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

}

@Entity({ name: 'rbac_map_role_permission' })
export class RolePermissionMap {
  @PrimaryGeneratedColumn({ name: 'role_permission_map_id' })
  RolePermissionMapId!: number;

  @Column({ name: 'role_id', type: 'integer', nullable: false })
  RoleId!: number;

  @Column({ name: 'permission_id', type: 'integer', nullable: false })
  PermissionId!: number;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'rbac_map_user_role' })
export class UserRoleMap {
  @PrimaryGeneratedColumn({ name: 'user_role_map_id' })
  UserRoleMapId!: number;

  @Column({ name: 'user_id', type: 'integer', nullable: false })
  UserId!: number;

  @Column({ name: 'role_id', type: 'integer', nullable: false })
  RoleId!: number;

  @Column({ name: 'start_date', type: 'timestamp', nullable: true })
  StartDate!: string | null;

  @Column({ name: 'end_date', type: 'timestamp', nullable: true })
  EndDate!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'rbac_permission' })
export class RbacPermission {
  @PrimaryGeneratedColumn({ name: 'permission_id' })
  PermissionId!: number;

  @Column({ name: 'permission_name', type: 'text', nullable: true })
  PermissionName!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'application_id', type: 'integer', nullable: true })
  ApplicationId!: number | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'rbac_role' })
export class RbacRole {
  @PrimaryGeneratedColumn({ name: 'role_id' })
  RoleId!: number;

  @Column({ name: 'role_name', type: 'text', nullable: true })
  RoleName!: string | null;

  @Column({ name: 'role_description', type: 'text', nullable: true })
  RoleDescription!: string | null;

  @Column({ name: 'role_type', type: 'text', nullable: true })
  RoleType!: string | null;

  @Column({ name: 'application_id', type: 'integer', nullable: true })
  ApplicationId!: number | null;

  @Column({ name: 'is_sys_admin', type: 'boolean', nullable: false })
  IsSysAdmin!: boolean;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'role_priority', type: 'integer', nullable: true })
  RolePriority!: number | null;

  @Column({ name: 'default_route_id', type: 'integer', nullable: true })
  DefaultRouteId!: number | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

}

@Entity({ name: 'rbac_route_config' })
export class DanpheRoute {
  @PrimaryGeneratedColumn({ name: 'route_id' })
  RouteId!: number;

  @Column({ name: 'url_full_path', type: 'text', nullable: true })
  UrlFullPath!: string | null;

  @Column({ name: 'display_name', type: 'text', nullable: true })
  DisplayName!: string | null;

  @Column({ name: 'permission_id', type: 'integer', nullable: true })
  PermissionId!: number | null;

  @Column({ name: 'parent_route_id', type: 'integer', nullable: true })
  ParentRouteId!: number | null;

  @Column({ name: 'default_show', type: 'boolean', nullable: true })
  DefaultShow!: boolean | null;

  @Column({ name: 'router_link', type: 'text', nullable: true })
  RouterLink!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

  @Column({ name: 'is_secondary_nav_in_dropdown', type: 'boolean', nullable: true })
  IsSecondaryNavInDropdown!: boolean | null;

  @Column({ name: 'css', type: 'text', nullable: true })
  Css!: string | null;

  @Column({ name: 'display_seq', type: 'integer', nullable: true })
  DisplaySeq!: number | null;

}

@Entity({ name: 'rbac_user' })
export class RbacUser {
  @PrimaryGeneratedColumn({ name: 'user_id' })
  UserId!: number;

  @Column({ name: 'employee_id', type: 'integer', nullable: false })
  EmployeeId!: number;

  @Column({ name: 'user_name', type: 'text', nullable: true })
  UserName!: string | null;

  @Column({ name: 'password', type: 'text', nullable: true })
  Password!: string | null;

  @Column({ name: 'email', type: 'text', nullable: true })
  Email!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

  @Column({ name: 'needs_password_update', type: 'boolean', nullable: true })
  NeedsPasswordUpdate!: boolean | null;

  @Column({ name: 'landing_page_route_id', type: 'integer', nullable: true })
  LandingPageRouteId!: number | null;

}
