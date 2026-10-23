/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';


@Entity({ name: 'core_cfg_look_ups' })
export class LookupsModel {
  @PrimaryGeneratedColumn({ name: 'lookup_id' })
  LookupId!: number;

  @Column({ name: 'module_name', type: 'text', nullable: true })
  ModuleName!: string | null;

  @Column({ name: 'lookup_name', type: 'text', nullable: true })
  LookupName!: string | null;

  @Column({ name: 'lookup_data_json', type: 'text', nullable: true })
  LookupDataJson!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

}

@Entity({ name: 'core_cfg_parameters' })
export class ParameterModel {
  @PrimaryGeneratedColumn({ name: 'parameter_id' })
  ParameterId!: number;

  @Column({ name: 'parameter_group_name', type: 'text', nullable: true })
  ParameterGroupName!: string | null;

  @Column({ name: 'parameter_name', type: 'text', nullable: true })
  ParameterName!: string | null;

  @Column({ name: 'parameter_value', type: 'text', nullable: true })
  ParameterValue!: string | null;

  @Column({ name: 'value_data_type', type: 'text', nullable: true })
  ValueDataType!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

}

@Entity({ name: 'core_dyntmp_option' })
export class Option {
  @PrimaryGeneratedColumn({ name: 'option_id' })
  OptionId!: number;

  @Column({ name: 'text', type: 'text', nullable: true })
  Text!: string | null;

  @Column({ name: 'question_id', type: 'integer', nullable: false })
  QuestionId!: number;

  @Column({ name: 'is_default', type: 'boolean', nullable: false })
  IsDefault!: boolean;

  @Column({ name: 'show_child_on_select', type: 'boolean', nullable: false })
  ShowChildOnSelect!: boolean;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'core_dyntmp_question' })
export class Question {
  @PrimaryGeneratedColumn({ name: 'question_id' })
  QuestionId!: number;

  @Column({ name: 'template_id', type: 'integer', nullable: false })
  TemplateId!: number;

  @Column({ name: 'qnair_id', type: 'integer', nullable: false })
  QnairId!: number;

  @Column({ name: 'text', type: 'text', nullable: true })
  Text!: string | null;

  @Column({ name: 'type', type: 'text', nullable: true })
  Type!: string | null;

  @Column({ name: 'parent_qtn_id', type: 'integer', nullable: true })
  ParentQtnId!: number | null;

  @Column({ name: 'display_seq', type: 'integer', nullable: true })
  DisplaySeq!: number | null;

  @Column({ name: 'show_childs', type: 'boolean', nullable: true })
  ShowChilds!: boolean | null;

}

@Entity({ name: 'core_dyntmp_questionnaire' })
export class Questionnaire {
  @PrimaryGeneratedColumn({ name: 'qnair_id' })
  QnairId!: number;

  @Column({ name: 'text', type: 'text', nullable: true })
  Text!: string | null;

  @Column({ name: 'template_id', type: 'integer', nullable: false })
  TemplateId!: number;

  @Column({ name: 'display_seq', type: 'integer', nullable: true })
  DisplaySeq!: number | null;

}

@Entity({ name: 'core_dyntmp_template' })
export class Template {
  @PrimaryGeneratedColumn({ name: 'template_id' })
  TemplateId!: number;

  @Column({ name: 'code', type: 'text', nullable: true })
  Code!: string | null;

  @Column({ name: 'text', type: 'text', nullable: true })
  Text!: string | null;

  @Column({ name: 'module_name', type: 'text', nullable: true })
  ModuleName!: string | null;

}

@Entity({ name: 'dyntemp_cfg_template' })
export class TemplateModel {
  @PrimaryGeneratedColumn({ name: 'template_id' })
  TemplateId!: number;

  @Column({ name: 'template_type_id', type: 'integer', nullable: false })
  TemplateTypeId!: number;

  @Column({ name: 'template_code', type: 'text', nullable: true })
  TemplateCode!: string | null;

  @Column({ name: 'template_name', type: 'text', nullable: true })
  TemplateName!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'print_content_html', type: 'text', nullable: true })
  PrintContentHTML!: string | null;

  @Column({ name: 'is_default_for_this_type', type: 'boolean', nullable: false })
  IsDefaultForThisType!: boolean;

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

@Entity({ name: 'dyntmp_map_template_field_mapping' })
export class TemplateFieldMappingModel {
  @PrimaryGeneratedColumn({ name: 'template_field_map_id' })
  TemplateFieldMapId!: number;

  @Column({ name: 'template_id', type: 'integer', nullable: false })
  TemplateId!: number;

  @Column({ name: 'field_master_id', type: 'integer', nullable: false })
  FieldMasterId!: number;

  @Column({ name: 'display_label', type: 'text', nullable: true })
  DisplayLabel!: string | null;

  @Column({ name: 'is_mandatory', type: 'boolean', nullable: false })
  IsMandatory!: boolean;

  @Column({ name: 'enter_sequence', type: 'integer', nullable: true })
  EnterSequence!: number | null;

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

@Entity({ name: 'dyntmp_mst_field_master' })
export class FieldMasterModel {
  @PrimaryGeneratedColumn({ name: 'field_master_id' })
  FieldMasterId!: number;

  @Column({ name: 'template_type_id', type: 'integer', nullable: false })
  TemplateTypeId!: number;

  @Column({ name: 'field_name', type: 'text', nullable: true })
  FieldName!: string | null;

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

  @Column({ name: 'is_compulsory_field', type: 'boolean', nullable: false })
  IsCompulsoryField!: boolean;

}

@Entity({ name: 'dyntmp_mst_template_type' })
export class TemplateTypeModel {
  @PrimaryGeneratedColumn({ name: 'template_type_id' })
  TemplateTypeId!: number;

  @Column({ name: 'template_type_code', type: 'text', nullable: true })
  TemplateTypeCode!: string | null;

  @Column({ name: 'template_type_name', type: 'text', nullable: true })
  TemplateTypeName!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

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
