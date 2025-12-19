import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import * as incidentsApi from '../api/incidents'
import {
  STATUS_LABELS,
  type ActionItem,
  type Incident,
  type IncidentStatus,
  type IncidentUpdate,
  type Postmortem,
} from '../api/types'
import AdminLayout from '../components/AdminLayout'
import SeverityBadge from '../components/SeverityBadge'
import StatusBadge from '../components/StatusBadge'
import Timeline from '../components/Timeline'
import { useEventStream } from '../hooks/useEventStream'
import { useToast } from '../components/ToastProvider'
import { formatDateTime, getAllowedTransitions } from '../utils/incidents'

const actionItemStatuses: ActionItem['status'][] = ['OPEN', 'IN_PROGRESS', 'DONE']

const postmortemFieldDefinitions: Array<{ key: keyof incidentsApi.PostmortemPayload; label: string }> = [
  { key: 'summary', label: 'Summary' },
  { key: 'impact', label: 'Impact' },
  { key: 'root_cause', label: 'Root cause' },
  { key: 'detection', label: 'Detection' },
  { key: 'resolution', label: 'Resolution' },
  { key: 'lessons_learned', label: 'Lessons learned' },
]

const emptyPostmortemForm: incidentsApi.PostmortemPayload = {
  summary: '',
  impact: '',
  root_cause: '',
  detection: '',
  resolution: '',
  lessons_learned: '',
}

const extractIncidentId = (data: unknown): string | null => {
  if (!data || typeof data !== 'object') {
    return null
  }
  const record = data as { id?: string; incident?: { id?: string } }
  if (record.incident && typeof record.incident.id === 'string') {
    return record.incident.id
  }
  if (typeof record.id === 'string') {
    return record.id
  }
  return null
}

const AdminIncidentDetailPage = () => {
  const { id = '' } = useParams()
  const [incident, setIncident] = useState<Incident | null>(null)
  const [updates, setUpdates] = useState<IncidentUpdate[]>([])
  const [postmortem, setPostmortem] = useState<Postmortem | null>(null)
  const [actionItems, setActionItems] = useState<ActionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'timeline' | 'postmortem'>('timeline')
  const [postmortemForm, setPostmortemForm] = useState(emptyPostmortemForm)
  const [transitionPayload, setTransitionPayload] = useState<incidentsApi.TransitionPayload>({
    status: 'IDENTIFIED',
    actor_name: '',
    message: '',
  })
  const [updateForm, setUpdateForm] = useState<incidentsApi.IncidentUpdatePayload>({
    message: '',
    created_by_name: '',
  })
  const [actionItemForm, setActionItemForm] = useState<incidentsApi.ActionItemPayload>({
    title: '',
    owner_name: '',
    due_date: '',
  })
  const [transitionSubmitting, setTransitionSubmitting] = useState(false)
  const [updateSubmitting, setUpdateSubmitting] = useState(false)
  const [transitionNotice, setTransitionNotice] = useState('')
  const [updateNotice, setUpdateNotice] = useState('')
  const { addToast } = useToast()

  const fetchIncident = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      const [incidentData, updateData] = await Promise.all([
        incidentsApi.getIncident(id),
        incidentsApi.listUpdates(id),
      ])
      setIncident(incidentData)
      setUpdates(updateData)

      try {
        const postmortemData = await incidentsApi.getPostmortem(id)
        setPostmortem(postmortemData)
        setPostmortemForm({
          summary: postmortemData.summary,
          impact: postmortemData.impact,
          root_cause: postmortemData.root_cause,
          detection: postmortemData.detection,
          resolution: postmortemData.resolution,
          lessons_learned: postmortemData.lessons_learned,
        })
        const items = await incidentsApi.listActionItems(id)
        setActionItems(items)
      } catch {
        setPostmortem(null)
        setPostmortemForm(emptyPostmortemForm)
        setActionItems([])
      }

      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchIncident()
  }, [fetchIncident])

  useEffect(() => {
    if (incident) {
      const nextStatus = getAllowedTransitions(incident.status)[0] || incident.status
      setTransitionPayload((prev) => ({ ...prev, status: nextStatus }))
    }
  }, [incident])

  useEventStream('admin', (payload) => {
    const payloadIncidentId = extractIncidentId(payload.data)
    if (payloadIncidentId && payloadIncidentId === id) {
      fetchIncident()
      addToast('Incident refreshed from live update')
    }
  })

  const allowedTransitions = useMemo(() => {
    if (!incident) return []
    return getAllowedTransitions(incident.status).filter((status) => status !== incident.status)
  }, [incident])

  const handleTransition = async (event: FormEvent) => {
    event.preventDefault()
    if (!id) return
    try {
      setTransitionSubmitting(true)
      setTransitionNotice('')
      const actor = transitionPayload.actor_name
      await incidentsApi.transitionIncident(id, transitionPayload)
      await fetchIncident()
      setTransitionPayload((prev) => ({ ...prev, message: '', actor_name: actor }))
      setTransitionNotice('Status update sent')
      addToast('Status update sent')
    } catch (err) {
      addToast((err as Error).message)
    } finally {
      setTransitionSubmitting(false)
    }
  }

  const handlePostUpdate = async (event: FormEvent) => {
    event.preventDefault()
    if (!id || !updateForm.message) return
    try {
      setUpdateSubmitting(true)
      setUpdateNotice('')
      const author = updateForm.created_by_name
      await incidentsApi.postUpdate(id, {
        ...updateForm,
        status_at_time: incident?.status,
      })
      setUpdateForm({ message: '', created_by_name: author })
      await fetchIncident()
      setUpdateNotice('Update sent')
      addToast('Update sent')
    } catch (err) {
      addToast((err as Error).message)
    } finally {
      setUpdateSubmitting(false)
    }
  }

  const canEditPostmortem = incident?.status === 'RESOLVED'

  const handlePostmortemSave = async (event: FormEvent) => {
    event.preventDefault()
    if (!id) return
    if (!canEditPostmortem) {
      addToast('Resolve the incident before editing the postmortem')
      return
    }
    try {
      let result: Postmortem
      if (postmortem) {
        result = await incidentsApi.updatePostmortem(id, postmortemForm)
      } else {
        result = await incidentsApi.createPostmortem(id, postmortemForm)
      }
      setPostmortem(result)
      setPostmortemForm({
        summary: result.summary,
        impact: result.impact,
        root_cause: result.root_cause,
        detection: result.detection,
        resolution: result.resolution,
        lessons_learned: result.lessons_learned,
      })
      if (!postmortem) {
        const items = await incidentsApi.listActionItems(id)
        setActionItems(items)
      }
      addToast('Postmortem saved')
    } catch (err) {
      addToast((err as Error).message)
    }
  }

  const handlePublish = async () => {
    if (!id || !postmortem) return
    if (!canEditPostmortem) {
      addToast('Resolve the incident before publishing the postmortem')
      return
    }
    try {
      const actor = incident?.created_by_name || 'admin'
      const result = await incidentsApi.publishPostmortem(id, actor)
      setPostmortem(result)
      addToast('Postmortem published')
    } catch (err) {
      addToast((err as Error).message)
    }
  }

  const handleAddActionItem = async (event: FormEvent) => {
    event.preventDefault()
    if (!id || !postmortem) return
    if (!canEditPostmortem) {
      addToast('Resolve the incident before adding action items')
      return
    }
    try {
      const payload = {
        ...actionItemForm,
        due_date: actionItemForm.due_date || null,
      }
      const item = await incidentsApi.createActionItem(id, payload)
      setActionItems((prev) => [...prev, item])
      setActionItemForm({ title: '', owner_name: '', due_date: '' })
      addToast('Action item added')
    } catch (err) {
      addToast((err as Error).message)
    }
  }

  const handleActionItemStatus = async (item: ActionItem, status: ActionItem['status']) => {
    if (!id) return
    try {
      const updated = await incidentsApi.updateActionItem(id, item.id, { status })
      setActionItems((prev) => prev.map((current) => (current.id === updated.id ? updated : current)))
    } catch (err) {
      addToast((err as Error).message)
    }
  }

  const handleExport = async () => {
    if (!id) return
    try {
      const markdown = await incidentsApi.exportPostmortemMarkdown(id)
      const blob = new Blob([markdown], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `postmortem-${id}.md`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      addToast((err as Error).message)
    }
  }

  if (loading) {
    return (
      <AdminLayout title="Loading incident">
        <p>Loading…</p>
      </AdminLayout>
    )
  }

  if (error) {
    return (
      <AdminLayout title="Incident detail">
        <p className="error">{error}</p>
      </AdminLayout>
    )
  }

  if (!incident) {
    return (
      <AdminLayout title="Incident detail">
        <p className="error">Incident not found</p>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout
      title={incident.title}
      subtitle="Timeline, transitions, and postmortem workspace."
      actions={
        <Link className="ghost-button" to="/admin/incidents">
          ← Back to list
        </Link>
      }
    >
      <div className="card incident-detail">
        <div className="incident-detail-header">
          <div>
            <h2>{incident.title}</h2>
            <p>{incident.summary}</p>
          </div>
          <div className="badges">
            <SeverityBadge severity={incident.severity} />
            <StatusBadge status={incident.status} />
          </div>
        </div>

        <div className="metadata">
          <span>Created {formatDateTime(incident.created_at)}</span>
          <span>Last updated {formatDateTime(incident.updated_at)}</span>
          <span>{incident.is_public ? 'Visible to customers' : 'Internal only'}</span>
        </div>

        <section className="transition-form">
          <h3>Transition status</h3>
          <form onSubmit={handleTransition}>
            <label>
              Next status
              <select
                value={transitionPayload.status}
                onChange={(event) => {
                  setTransitionPayload((prev) => ({
                    ...prev,
                    status: event.target.value as IncidentStatus,
                  }))
                  setTransitionNotice('')
                }}
              >
                {allowedTransitions.length ? (
                  allowedTransitions.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))
                ) : (
                  <option value="">No transitions available</option>
                )}
              </select>
            </label>
            <label>
              Message
              <textarea
                value={transitionPayload.message || ''}
                onChange={(event) => {
                  setTransitionPayload((prev) => ({ ...prev, message: event.target.value }))
                  setTransitionNotice('')
                }}
              />
            </label>
            <label>
              Your name
              <input
                required
                value={transitionPayload.actor_name}
                onChange={(event) => {
                  setTransitionPayload((prev) => ({ ...prev, actor_name: event.target.value }))
                  setTransitionNotice('')
                }}
              />
            </label>
            <button className="primary" disabled={!allowedTransitions.length || transitionSubmitting}>
              {transitionSubmitting ? 'Sending…' : 'Update status'}
            </button>
            {transitionNotice && (
              <p className="form-feedback" role="status" aria-live="polite">
                {transitionNotice}
              </p>
            )}
          </form>
        </section>

        <section className="tabs">
          <button
            className={activeTab === 'timeline' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('timeline')}
          >
            Timeline
          </button>
          <button
            className={activeTab === 'postmortem' ? 'tab active' : 'tab'}
            onClick={() => {
              if (canEditPostmortem) {
                setActiveTab('postmortem')
              }
            }}
            disabled={!canEditPostmortem}
            aria-disabled={!canEditPostmortem}
            title={!canEditPostmortem ? 'Resolve the incident to edit the postmortem' : undefined}
          >
            Postmortem
          </button>
        </section>
        {!canEditPostmortem && (
          <p className="form-helper">Resolve this incident to unlock the postmortem workspace.</p>
        )}

        {activeTab === 'timeline' ? (
          <>
            <section>
              <h3>Post update</h3>
              <form className="form-grid" onSubmit={handlePostUpdate}>
                <label>
                  Message
                  <textarea
                    required
                    value={updateForm.message}
                    onChange={(event) => {
                      setUpdateForm((prev) => ({ ...prev, message: event.target.value }))
                      setUpdateNotice('')
                    }}
                  />
                </label>
                <label>
                  Your name
                  <input
                    required
                    value={updateForm.created_by_name}
                    onChange={(event) => {
                      setUpdateForm((prev) => ({ ...prev, created_by_name: event.target.value }))
                      setUpdateNotice('')
                    }}
                  />
                </label>
                <button className="primary" disabled={updateSubmitting}>
                  {updateSubmitting ? 'Posting…' : 'Post update'}
                </button>
                {updateNotice && (
                  <p className="form-feedback" role="status" aria-live="polite">
                    {updateNotice}
                  </p>
                )}
              </form>
            </section>
            <section>
              <h3>Timeline</h3>
              <Timeline updates={updates} />
            </section>
          </>
        ) : (
          <section>
            <h3>Postmortem</h3>
            <form className="form-grid" onSubmit={handlePostmortemSave}>
              {postmortemFieldDefinitions.map(({ key, label }) => (
                <label key={key}>
                  {label}
                  <textarea
                    value={postmortemForm[key] || ''}
                    onChange={(event) =>
                      setPostmortemForm((prev) => ({ ...prev, [key]: event.target.value }))
                    }
                  />
                </label>
              ))}
              <button className="primary">{postmortem ? 'Save changes' : 'Create postmortem'}</button>
            </form>
            {postmortem && (
              <div className="postmortem-actions">
                <button onClick={handlePublish} disabled={postmortem.published}>
                  {postmortem.published ? 'Published' : 'Publish'}
                </button>
                <button onClick={handleExport}>Export Markdown</button>
              </div>
            )}

            {postmortem && (
              <>
                <section>
                  <h4>Action items</h4>
                  <form className="form-grid" onSubmit={handleAddActionItem}>
                    <label>
                      Title
                      <input
                        required
                        value={actionItemForm.title}
                        onChange={(event) =>
                          setActionItemForm((prev) => ({ ...prev, title: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      Owner
                      <input
                        required
                        value={actionItemForm.owner_name}
                        onChange={(event) =>
                          setActionItemForm((prev) => ({ ...prev, owner_name: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      Due date
                      <input
                        type="date"
                        value={actionItemForm.due_date || ''}
                        onChange={(event) =>
                          setActionItemForm((prev) => ({ ...prev, due_date: event.target.value }))
                        }
                      />
                    </label>
                    <button className="primary">Add action item</button>
                  </form>

                  <ul className="action-items">
                    {actionItems.map((item) => (
                      <li key={item.id}>
                        <div>
                          <strong>{item.title}</strong>
                          <p>Owner: {item.owner_name}</p>
                          {item.due_date && <p>Due: {item.due_date}</p>}
                        </div>
                        <select
                          value={item.status}
                          onChange={(event) =>
                            handleActionItemStatus(item, event.target.value as ActionItem['status'])
                          }
                        >
                          {actionItemStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </li>
                    ))}
                    {!actionItems.length && <p className="empty">No action items added yet.</p>}
                  </ul>
                </section>
                <section>
                  <h4>Timeline reference</h4>
                  <Timeline updates={updates} />
                </section>
              </>
            )}
          </section>
        )}
      </div>
    </AdminLayout>
  )
}

export default AdminIncidentDetailPage
