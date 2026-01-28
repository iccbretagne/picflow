"use client"

import { useCallback, useEffect, useState } from "react"
import { Button, Textarea } from "@/components/ui"

type Comment = {
  id: string
  content: string
  createdAt: string
  authorName: string | null
  replies?: Comment[]
}

interface CommentThreadProps {
  mediaId: string
}

export function CommentThread({ mediaId }: CommentThreadProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadComments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/media/${mediaId}/comments`)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error?.message || "Erreur lors du chargement des commentaires")
      }
      setComments(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
    } finally {
      setLoading(false)
    }
  }, [mediaId])

  useEffect(() => {
    loadComments()
  }, [loadComments])

  async function submit() {
    if (!content.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/media/${mediaId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error?.message || "Erreur lors de l'envoi")
      }
      setContent("")
      await loadComments()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Ajouter un commentaire..."
          rows={3}
        />
        <div className="mt-2 flex justify-end">
          <Button onClick={submit} loading={submitting} disabled={!content.trim()}>
            Envoyer
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-icc-rouge">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Chargement...</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-500">Aucun commentaire</p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="border border-gray-200 rounded-lg p-3">
              <div className="text-sm text-gray-800 whitespace-pre-wrap">{comment.content}</div>
              <div className="mt-2 text-xs text-gray-500">
                {comment.authorName || "Utilisateur"} • {new Date(comment.createdAt).toLocaleString("fr-FR")}
              </div>
              {comment.replies && comment.replies.length > 0 && (
                <div className="mt-3 space-y-2 pl-4 border-l border-gray-200">
                  {comment.replies.map((reply) => (
                    <div key={reply.id}>
                      <div className="text-sm text-gray-800 whitespace-pre-wrap">{reply.content}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        {reply.authorName || "Utilisateur"} • {new Date(reply.createdAt).toLocaleString("fr-FR")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
