import { formatTimestamp } from "./format";
import type { SelectionContext, TemplateFrontMatterField } from "./types";

export interface TemplateVariables {
  [key: string]: string;
}

export function createTemplateVariables(
  context: SelectionContext,
): TemplateVariables {
  const created = new Date(context.createdAt);
  const formatted = formatTimestamp(created);
  const iso = created.toISOString();
  const markdown = context.markdown.trim();
  return {
    time: formatted,
    createdAt: formatted,
    updatedAt: formatted,
    isoTime: iso,
    isoCreatedAt: iso,
    isoUpdatedAt: iso,
    title: context.title,
    url: context.textFragmentUrl || context.baseUrl,
    baseUrl: context.baseUrl,
    content: markdown,
  };
}

const PLACEHOLDER_PATTERN = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;

export function renderTemplate(
  template: string,
  variables: TemplateVariables,
): string {
  return template.replace(PLACEHOLDER_PATTERN, (_match, key: string) => {
    const replacement = variables[key];
    return replacement ?? "";
  });
}

export function renderFrontMatterValue(
  field: TemplateFrontMatterField,
  variables: TemplateVariables,
): string {
  const value = field.value ?? "";
  return renderTemplate(value, variables).trim();
}
