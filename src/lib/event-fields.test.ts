import { describe, expect, it } from "vitest";
import {
  buildCustomFieldsSchema,
  EventFieldDefinitionSchema,
  type EventFieldDefinition,
} from "./event-fields";

describe("EventFieldDefinitionSchema", () => {
  it("accepts a valid text field", () => {
    const result = EventFieldDefinitionSchema.safeParse({
      key: "shirtSize",
      label: "Shirt size",
      type: "text",
      required: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a select field with no options", () => {
    const result = EventFieldDefinitionSchema.safeParse({
      key: "ticketType",
      label: "Ticket type",
      type: "select",
      required: true,
      options: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a key that isn't a valid identifier", () => {
    const result = EventFieldDefinitionSchema.safeParse({
      key: "ticket-type",
      label: "Ticket type",
      type: "text",
      required: true,
    });
    expect(result.success).toBe(false);
  });
});

describe("buildCustomFieldsSchema", () => {
  const fields: EventFieldDefinition[] = [
    { key: "ageGroup", label: "Age group", type: "select", required: true, options: ["Under 18", "18+"] },
    { key: "ticketType", label: "Ticket type", type: "select", required: true, options: ["full", "socials"] },
    { key: "needsBus", label: "Needs bus", type: "checkbox", required: false },
    { key: "shirtSize", label: "Shirt size", type: "text", required: false },
    { key: "yearLeft", label: "Year left", type: "number", required: true },
  ];

  it("accepts input matching every field's declared type", () => {
    const schema = buildCustomFieldsSchema(fields);
    const result = schema.safeParse({
      ageGroup: "18+",
      ticketType: "full",
      needsBus: true,
      shirtSize: "L",
      yearLeft: 2020,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a select value not in that field's options", () => {
    const schema = buildCustomFieldsSchema(fields);
    const result = schema.safeParse({
      ageGroup: "not a real option",
      ticketType: "full",
      needsBus: true,
      yearLeft: 2020,
    });
    expect(result.success).toBe(false);
  });

  it("allows omitting a non-required field", () => {
    const schema = buildCustomFieldsSchema(fields);
    const result = schema.safeParse({
      ageGroup: "18+",
      ticketType: "full",
      yearLeft: 2020,
    });
    expect(result.success).toBe(true);
  });

  it("rejects omitting a required field", () => {
    const schema = buildCustomFieldsSchema(fields);
    const result = schema.safeParse({
      ticketType: "full",
      needsBus: true,
      yearLeft: 2020,
    });
    expect(result.success).toBe(false);
  });

  it("builds an empty schema for an event with no custom fields", () => {
    const schema = buildCustomFieldsSchema([]);
    expect(schema.safeParse({}).success).toBe(true);
  });
});
