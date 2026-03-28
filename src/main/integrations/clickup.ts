import log from '../utils/logger'

const BASE_URL = 'https://api.clickup.com/api/v2'

interface ClickUpTeam {
  id: string
  name: string
}

interface ClickUpSpace {
  id: string
  name: string
}

interface ClickUpFolder {
  id: string
  name: string
}

export interface ClickUpList {
  id: string
  name: string
  space?: { id: string; name: string }
  folder?: { id: string; name: string }
}

interface ActionItem {
  assignee: string
  task: string
  deadline: string | null
}

async function clickupFetch(path: string, apiKey: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
      ...options.headers
    }
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`ClickUp API error ${response.status}: ${text}`)
  }

  return response
}

export async function testConnection(apiKey: string): Promise<boolean> {
  try {
    const res = await clickupFetch('/user', apiKey)
    const data = await res.json()
    return !!data.user
  } catch (err) {
    log.error('ClickUp connection test failed:', err)
    return false
  }
}

export async function getTeams(apiKey: string): Promise<ClickUpTeam[]> {
  const res = await clickupFetch('/team', apiKey)
  const data = await res.json()
  return data.teams || []
}

export async function getSpaces(apiKey: string, teamId: string): Promise<ClickUpSpace[]> {
  const res = await clickupFetch(`/team/${teamId}/space`, apiKey)
  const data = await res.json()
  return data.spaces || []
}

export async function getFolders(apiKey: string, spaceId: string): Promise<ClickUpFolder[]> {
  const res = await clickupFetch(`/space/${spaceId}/folder`, apiKey)
  const data = await res.json()
  return data.folders || []
}

export async function getLists(apiKey: string, folderId: string): Promise<ClickUpList[]> {
  const res = await clickupFetch(`/folder/${folderId}/list`, apiKey)
  const data = await res.json()
  return data.lists || []
}

export async function getFolderlessLists(apiKey: string, spaceId: string): Promise<ClickUpList[]> {
  const res = await clickupFetch(`/space/${spaceId}/list`, apiKey)
  const data = await res.json()
  return data.lists || []
}

export async function getAllLists(apiKey: string): Promise<ClickUpList[]> {
  const allLists: ClickUpList[] = []

  const teams = await getTeams(apiKey)
  for (const team of teams) {
    const spaces = await getSpaces(apiKey, team.id)
    for (const space of spaces) {
      // Folderless lists
      const folderlessLists = await getFolderlessLists(apiKey, space.id)
      for (const list of folderlessLists) {
        allLists.push({ ...list, space: { id: space.id, name: space.name } })
      }

      // Lists inside folders
      const folders = await getFolders(apiKey, space.id)
      for (const folder of folders) {
        const lists = await getLists(apiKey, folder.id)
        for (const list of lists) {
          allLists.push({
            ...list,
            space: { id: space.id, name: space.name },
            folder: { id: folder.id, name: folder.name }
          })
        }
      }
    }
  }

  return allLists
}

export async function createTask(
  apiKey: string,
  listId: string,
  actionItem: ActionItem,
  meetingTitle: string
): Promise<string> {
  const body = {
    name: actionItem.task,
    description: `From meeting: ${meetingTitle}\nAssignee: ${actionItem.assignee}\n\nThis action item was automatically created by MeetRec.`,
    due_date: actionItem.deadline ? parseDateToTimestamp(actionItem.deadline) : undefined,
    priority: 3, // Normal
    tags: ['meeting-action-item']
  }

  const res = await clickupFetch(`/list/${listId}/task`, apiKey, {
    method: 'POST',
    body: JSON.stringify(body)
  })

  const data = await res.json()
  log.info('Created ClickUp task:', data.id)
  return data.id
}

export async function pushActionItems(
  apiKey: string,
  listId: string,
  actionItems: ActionItem[],
  meetingTitle: string
): Promise<string[]> {
  const taskIds: string[] = []

  for (const item of actionItems) {
    try {
      const taskId = await createTask(apiKey, listId, item, meetingTitle)
      taskIds.push(taskId)
    } catch (err) {
      log.error('Failed to create ClickUp task:', err)
    }
  }

  return taskIds
}

function parseDateToTimestamp(dateStr: string): number {
  // Try to parse relative dates like "Friday", "next week", etc.
  const now = new Date()
  const lower = dateStr.toLowerCase().trim()

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const dayIndex = dayNames.indexOf(lower)

  if (dayIndex !== -1) {
    const currentDay = now.getDay()
    let daysUntil = dayIndex - currentDay
    if (daysUntil <= 0) daysUntil += 7
    const target = new Date(now)
    target.setDate(target.getDate() + daysUntil)
    target.setHours(17, 0, 0, 0) // 5 PM
    return target.getTime()
  }

  // Try direct date parse
  const parsed = new Date(dateStr)
  if (!isNaN(parsed.getTime())) {
    return parsed.getTime()
  }

  // Default: 1 week from now
  return now.getTime() + 7 * 24 * 60 * 60 * 1000
}
