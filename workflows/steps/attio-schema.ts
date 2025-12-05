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

  const objects: ObjectDefinition[] = [];

  for (const obj of response.data) {
    const attrsResponse = await attioRequest<{ data: AttioApiAttribute[] }>(
      `/objects/${obj.api_slug}/attributes`,
      apiKey
    );

    objects.push({
      workspaceId: obj.id.workspace_id,
      objectId: obj.id.object_id,
      apiSlug: obj.api_slug,
      singularNoun: obj.singular_noun,
      pluralNoun: obj.plural_noun,
      createdAt: obj.created_at,
      attributes: attrsResponse.data.map(mapAttribute),
    });
  }

  return objects;
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

  const lists: ListDefinition[] = [];

  for (const list of response.data) {
    const attrsResponse = await attioRequest<{ data: AttioApiAttribute[] }>(
      `/lists/${list.api_slug}/attributes`,
      apiKey
    );

    lists.push({
      id: list.id.list_id,
      apiSlug: list.api_slug,
      name: list.name,
      parentObject: list.parent_object,
      parentObjectId: list.parent_object_id,
      createdAt: list.created_at,
      workspaceMemberAccess: list.workspace_member_access,
      attributes: attrsResponse.data.map(mapAttribute),
    });
  }

  return lists;
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

// Local version for testing (no "use step" directive)
export async function fetchFullSchemaLocal(): Promise<AttioSchema> {
  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) throw new Error("ATTIO_API_KEY not configured");

  // Fetch objects
  const objectsResponse = await attioRequest<{ data: AttioApiObject[] }>("/objects", apiKey);
  const objects: ObjectDefinition[] = [];

  for (const obj of objectsResponse.data) {
    const attrsResponse = await attioRequest<{ data: AttioApiAttribute[] }>(
      `/objects/${obj.api_slug}/attributes`,
      apiKey
    );

    objects.push({
      workspaceId: obj.id.workspace_id,
      objectId: obj.id.object_id,
      apiSlug: obj.api_slug,
      singularNoun: obj.singular_noun,
      pluralNoun: obj.plural_noun,
      createdAt: obj.created_at,
      attributes: attrsResponse.data.map(mapAttribute),
    });
  }

  // Fetch lists
  const listsResponse = await attioRequest<{ data: AttioApiList[] }>("/lists", apiKey);
  const lists: ListDefinition[] = [];

  for (const list of listsResponse.data) {
    const attrsResponse = await attioRequest<{ data: AttioApiAttribute[] }>(
      `/lists/${list.api_slug}/attributes`,
      apiKey
    );

    lists.push({
      id: list.id.list_id,
      apiSlug: list.api_slug,
      name: list.name,
      parentObject: list.parent_object,
      parentObjectId: list.parent_object_id,
      createdAt: list.created_at,
      workspaceMemberAccess: list.workspace_member_access,
      attributes: attrsResponse.data.map(mapAttribute),
    });
  }

  // Fetch workspace members
  const membersResponse = await attioRequest<{ data: AttioApiWorkspaceMember[] }>(
    "/workspace_members",
    apiKey
  );

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
