// Minimaler JSON-Schema-Validator (Subset) für die JSON-LD-Tests:
// unterstützt type, required, properties, items, minItems, const, enum.
// Bewusst testintern statt ajv — keine zusätzliche Dependency.

export type JsonSchema = {
  type?: 'array' | 'boolean' | 'number' | 'object' | 'string'
  required?: string[]
  properties?: Record<string, JsonSchema>
  items?: JsonSchema
  minItems?: number
  const?: unknown
  enum?: unknown[]
}

export const validate = (
  schema: JsonSchema,
  data: unknown,
  path = '$',
): string[] => {
  const errors: string[] = []

  if (schema.const !== undefined && data !== schema.const) {
    errors.push(`${path}: erwartet ${JSON.stringify(schema.const)}`)
  }
  if (schema.enum && !schema.enum.includes(data)) {
    errors.push(`${path}: nicht in enum ${JSON.stringify(schema.enum)}`)
  }

  if (schema.type === 'array') {
    if (!Array.isArray(data)) {
      errors.push(`${path}: erwartet Array`)
      return errors
    }
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      errors.push(`${path}: mindestens ${schema.minItems} Einträge erwartet`)
    }
    if (schema.items) {
      data.forEach((item, i) =>
        errors.push(...validate(schema.items as JsonSchema, item, `${path}[${i}]`)),
      )
    }
    return errors
  }

  if (schema.type === 'object' || schema.properties || schema.required) {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      errors.push(`${path}: erwartet Objekt`)
      return errors
    }
    const record = data as Record<string, unknown>
    for (const key of schema.required ?? []) {
      if (record[key] === undefined) {
        errors.push(`${path}.${key}: Pflichtfeld fehlt`)
      }
    }
    for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
      if (record[key] !== undefined) {
        errors.push(...validate(childSchema, record[key], `${path}.${key}`))
      }
    }
    return errors
  }

  if (schema.type === 'string' && typeof data !== 'string') {
    errors.push(`${path}: erwartet String`)
  }
  if (schema.type === 'number' && typeof data !== 'number') {
    errors.push(`${path}: erwartet Number`)
  }
  return errors
}
