import type {
  ObjectDefinition,
  ListDefinition,
  WorkspaceMember,
  AttributeDefinition,
  AttioApiObject,
  AttioApiAttribute,
  AttioApiList,
  AttioApiWorkspaceMember,
  AttioSchema,
} from "@/src/services/attio/schema-types";

const ATTIO_BASE_URL = "https://api.attio.com/v2";

// Schema cache (5 minute TTL)
const SCHEMA_CACHE_TTL = 5 * 60 * 1000;
let schemaCache: AttioSchema | null = null;
let schemaCacheTime = 0;

async function attioRequest<T>(
  endpoint: string,
  apiKey: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${ATTIO_BASE_URL}${endpoint}`;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Attio API error: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  return response.json() as Promise<T>;
}

function mapAttribute(attr: AttioApiAttribute): AttributeDefinition {
  return {
    id: attr.id.attribute_id,
    apiSlug: attr.api_slug,
    title: attr.title,
    description: attr.description || undefined,
    type: attr.type as AttributeDefinition["type"],
    isRequired: attr.is_required,
    isWritable: attr.is_writable,
    isUnique: attr.is_unique,
    isArchived: attr.is_archived,
    isMultiselect: attr.is_multiselect,
    config: attr.config as AttributeDefinition["config"],
  };
}

export async function getObjects(): Promise<ObjectDefinition[]> {
  "use step";

  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) throw new Error("ATTIO_API_KEY not configured");

  const response = await attioRequest<{ data: AttioApiObject[] }>("/objects", apiKey);

  // Fetch all attributes in parallel
  const objectsWithAttrs = await Promise.all(
    response.data.map(async (obj) => {
      const attrsResponse = await attioRequest<{ data: AttioApiAttribute[] }>(
        `/objects/${obj.api_slug}/attributes`,
        apiKey
      );

      return {
        workspaceId: obj.id.workspace_id,
        objectId: obj.id.object_id,
        apiSlug: obj.api_slug,
        singularNoun: obj.singular_noun,
        pluralNoun: obj.plural_noun,
        createdAt: obj.created_at,
        attributes: attrsResponse.data.map(mapAttribute),
      };
    })
  );

  return objectsWithAttrs;
}

export async function getObjectAttributes(objectSlug: string): Promise<AttributeDefinition[]> {
  "use step";

  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) throw new Error("ATTIO_API_KEY not configured");

  const response = await attioRequest<{ data: AttioApiAttribute[] }>(
    `/objects/${objectSlug}/attributes`,
    apiKey
  );

  return response.data.map(mapAttribute);
}

export async function getLists(): Promise<ListDefinition[]> {
  "use step";

  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) throw new Error("ATTIO_API_KEY not configured");

  const response = await attioRequest<{ data: AttioApiList[] }>("/lists", apiKey);

  // Fetch all attributes in parallel
  const listsWithAttrs = await Promise.all(
    response.data.map(async (list) => {
      const attrsResponse = await attioRequest<{ data: AttioApiAttribute[] }>(
        `/lists/${list.api_slug}/attributes`,
        apiKey
      );

      return {
        id: list.id.list_id,
        apiSlug: list.api_slug,
        name: list.name,
        parentObject: list.parent_object,
        parentObjectId: list.parent_object_id,
        createdAt: list.created_at,
        workspaceMemberAccess: list.workspace_member_access,
        attributes: attrsResponse.data.map(mapAttribute),
      };
    })
  );

  return listsWithAttrs;
}

export async function getWorkspaceMembers(): Promise<WorkspaceMember[]> {
  "use step";

  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) throw new Error("ATTIO_API_KEY not configured");

  const response = await attioRequest<{ data: AttioApiWorkspaceMember[] }>(
    "/workspace_members",
    apiKey
  );

  return response.data.map((member) => ({
    id: member.id.workspace_member_id,
    firstName: member.first_name,
    lastName: member.last_name,
    email: member.email_address,
    avatarUrl: member.avatar_url || undefined,
    accessLevel: member.access_level,
    createdAt: member.created_at,
  }));
}

export async function fetchFullSchema(): Promise<AttioSchema> {
  "use step";

  const [objects, lists, workspaceMembers] = await Promise.all([
    getObjects(),
    getLists(),
    getWorkspaceMembers(),
  ]);

  return {
    objects,
    lists,
    workspaceMembers,
    lastFetched: Date.now(),
  };
}

export async function fetchFullSchemaCached(): Promise<AttioSchema> {
  "use step";

  const now = Date.now();
  if (schemaCache && now - schemaCacheTime < SCHEMA_CACHE_TTL) {
    return schemaCache;
  }

  const schema = await fetchFullSchema();
  schemaCache = schema;
  schemaCacheTime = now;
  return schema;
}

// Local version for testing (no "use step" directive)
export async function fetchFullSchemaLocal(): Promise<AttioSchema> {
  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) throw new Error("ATTIO_API_KEY not configured");

  // Fetch objects, lists, and members in parallel
  const [objectsResponse, listsResponse, membersResponse] = await Promise.all([
    attioRequest<{ data: AttioApiObject[] }>("/objects", apiKey),
    attioRequest<{ data: AttioApiList[] }>("/lists", apiKey),
    attioRequest<{ data: AttioApiWorkspaceMember[] }>("/workspace_members", apiKey),
  ]);

  // Fetch all object and list attributes in parallel
  const [objects, lists] = await Promise.all([
    Promise.all(
      objectsResponse.data.map(async (obj) => {
        const attrsResponse = await attioRequest<{ data: AttioApiAttribute[] }>(
          `/objects/${obj.api_slug}/attributes`,
          apiKey
        );
        return {
          workspaceId: obj.id.workspace_id,
          objectId: obj.id.object_id,
          apiSlug: obj.api_slug,
          singularNoun: obj.singular_noun,
          pluralNoun: obj.plural_noun,
          createdAt: obj.created_at,
          attributes: attrsResponse.data.map(mapAttribute),
        };
      })
    ),
    Promise.all(
      listsResponse.data.map(async (list) => {
        const attrsResponse = await attioRequest<{ data: AttioApiAttribute[] }>(
          `/lists/${list.api_slug}/attributes`,
          apiKey
        );
        return {
          id: list.id.list_id,
          apiSlug: list.api_slug,
          name: list.name,
          parentObject: list.parent_object,
          parentObjectId: list.parent_object_id,
          createdAt: list.created_at,
          workspaceMemberAccess: list.workspace_member_access,
          attributes: attrsResponse.data.map(mapAttribute),
        };
      })
    ),
  ]);

  const workspaceMembers = membersResponse.data.map((member) => ({
    id: member.id.workspace_member_id,
    firstName: member.first_name,
    lastName: member.last_name,
    email: member.email_address,
    avatarUrl: member.avatar_url || undefined,
    accessLevel: member.access_level,
    createdAt: member.created_at,
  }));

  return {
    objects,
    lists,
    workspaceMembers,
    lastFetched: Date.now(),
  };
}
