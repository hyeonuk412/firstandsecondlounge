"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Viewer = {
  channelId: string;
  channelName: string;
  nickname: string;
  verifiedAt: string;
};

type BoardAttachment = { url: string; name: string; type: string };
type BoardAuthor = { channelId: string; channelName: string; nickname: string };
type BoardComment = { id: string; author: BoardAuthor; body: string; attachment?: BoardAttachment; createdAt: string };
type BoardPost = {
  id: string;
  author: BoardAuthor;
  body: string;
  attachment?: BoardAttachment;
  createdAt: string;
  updatedAt: string;
  comments: BoardComment[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function uploadImage(file: File): Promise<BoardAttachment> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/board/upload", { method: "POST", body: form });
  const data = (await response.json().catch(() => ({}))) as Partial<BoardAttachment> & { error?: string };
  if (!response.ok || !data.url) throw new Error(data.error || "이미지를 올리지 못했어요.");
  return { url: data.url, name: data.name || file.name, type: data.type || file.type };
}

function authorName(author: BoardAuthor) {
  return author.nickname || author.channelName || "익명";
}

export default function BoardClient({ adminNicknames }: { adminNicknames: string[] }) {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [loadingViewer, setLoadingViewer] = useState(true);
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [error, setError] = useState("");
  const [posting, setPosting] = useState(false);
  const [newImageName, setNewImageName] = useState("");
  const [busyComment, setBusyComment] = useState("");
  const [commentImageName, setCommentImageName] = useState<Record<string, string>>({});
  const newFormRef = useRef<HTMLFormElement>(null);

  const isAdmin = Boolean(viewer && (adminNicknames.includes(viewer.nickname) || adminNicknames.includes(viewer.channelName)));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/auth/chzzk/me", { cache: "no-store" });
        const payload = (await response.json()) as { authenticated?: boolean; viewer?: Viewer | null };
        if (!cancelled) setViewer(payload.authenticated ? payload.viewer ?? null : null);
      } catch {
        if (!cancelled) setViewer(null);
      } finally {
        if (!cancelled) setLoadingViewer(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    loadPosts();
  }, []);

  async function loadPosts() {
    try {
      const response = await fetch("/api/board", { cache: "no-store" });
      if (!response.ok) throw new Error("게시글을 불러오지 못했어요.");
      const payload = (await response.json()) as { posts: BoardPost[] };
      setPosts(payload.posts);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "게시글을 불러오지 못했어요.");
    } finally {
      setLoadingPosts(false);
    }
  }

  async function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!viewer || posting) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = String(data.get("body") || "").trim();
    const file = data.get("file");
    const hasFile = file instanceof File && file.size > 0;
    if (!body && !hasFile) return;

    setPosting(true);
    setError("");
    try {
      let attachment: BoardAttachment | null = null;
      if (hasFile) attachment = await uploadImage(file);
      const response = await fetch("/api/board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, attachment }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "글을 올리지 못했어요.");
      }
      const payload = (await response.json()) as { post: BoardPost };
      setPosts((current) => [payload.post, ...current]);
      form.reset();
      setNewImageName("");
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : "글을 올리지 못했어요.");
    } finally {
      setPosting(false);
    }
  }

  async function submitComment(postId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!viewer || busyComment) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = String(data.get("body") || "").trim();
    const file = data.get("file");
    const hasFile = file instanceof File && file.size > 0;
    if (!body && !hasFile) return;

    setBusyComment(postId);
    setError("");
    try {
      let attachment: BoardAttachment | null = null;
      if (hasFile) attachment = await uploadImage(file);
      const response = await fetch(`/api/board/${encodeURIComponent(postId)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, attachment }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "댓글을 올리지 못했어요.");
      }
      const payload = (await response.json()) as { post: BoardPost };
      setPosts((current) => current.map((post) => (post.id === postId ? payload.post : post)));
      form.reset();
      setCommentImageName((current) => ({ ...current, [postId]: "" }));
    } catch (commentError) {
      setError(commentError instanceof Error ? commentError.message : "댓글을 올리지 못했어요.");
    } finally {
      setBusyComment("");
    }
  }

  async function removePost(postId: string) {
    if (!isAdmin || !window.confirm("이 게시글을 삭제할까요?")) return;
    const response = await fetch(`/api/admin/board/${encodeURIComponent(postId)}`, { method: "DELETE" });
    if (response.ok) setPosts((current) => current.filter((post) => post.id !== postId));
  }

  async function removeComment(postId: string, commentId: string) {
    if (!isAdmin || !window.confirm("이 댓글을 삭제할까요?")) return;
    const response = await fetch(`/api/admin/board/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`, { method: "DELETE" });
    if (response.ok) {
      setPosts((current) => current.map((post) => (post.id === postId
        ? { ...post, comments: post.comments.filter((comment) => comment.id !== commentId) }
        : post)));
    }
  }

  return (
    <main className="cc-board">
      <header className="dm-page-header">
        <a className="dm-home-link" href="/">첫째와둘째 라운지</a>
        <div className="dm-header-user">
          {viewer ? (
            <>
              <span>{authorName(viewer)}님</span>
              <a href="/api/auth/chzzk/logout">로그아웃</a>
            </>
          ) : (
            <a href="/api/auth/chzzk/start?next=/board">치지직으로 로그인</a>
          )}
        </div>
      </header>

      <section className="cc-board-inner">
        <div className="cc-board-title">
          <p className="kicker">FREE BOARD</p>
          <h1>자유게시판</h1>
        </div>

        {viewer ? (
          <form className="cc-board-new" onSubmit={submitPost} ref={newFormRef}>
            <textarea name="body" rows={3} placeholder={`${authorName(viewer)}님, 자유롭게 이야기를 남겨보세요.`} />
            <div className="cc-board-new-foot">
              <label className="dm-attach-btn">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3 3 0 0 1 4.24 4.24l-9.19 9.19a1 1 0 0 1-1.42-1.42l8.49-8.48" /></svg>
                {newImageName || "이미지 첨부"}
                <input type="file" name="file" accept="image/*" hidden onChange={(event) => setNewImageName(event.target.files?.[0]?.name || "")} />
              </label>
              <button type="submit" disabled={posting}>{posting ? "올리는 중" : "글 올리기"}</button>
            </div>
          </form>
        ) : loadingViewer ? null : (
          <div className="cc-board-login">
            <p>글과 댓글은 로그인 후 남길 수 있어요. (닉네임만 표시되고 다른 정보는 수집하지 않아요)</p>
            <a className="dm-login-cta" href="/api/auth/chzzk/start?next=/board">치지직으로 로그인</a>
          </div>
        )}

        {error ? <p className="dm-page-error">{error}</p> : null}

        <div className="cc-board-list">
          {loadingPosts ? (
            <p className="cc-empty">불러오는 중이에요…</p>
          ) : posts.length ? (
            posts.map((post) => (
              <article className="cc-board-post" key={post.id}>
                <header className="cc-board-post-head">
                  <div className="cc-board-author">
                    <span className="cc-board-avatar">{authorName(post.author).slice(0, 1)}</span>
                    <div>
                      <strong>{authorName(post.author)}</strong>
                      <time>{formatDate(post.createdAt)}</time>
                    </div>
                  </div>
                  {isAdmin ? <button className="cc-board-del" type="button" onClick={() => removePost(post.id)}>삭제</button> : null}
                </header>
                {post.body ? <p className="cc-board-body">{post.body}</p> : null}
                {post.attachment ? (
                  <a className="cc-board-img" href={post.attachment.url} target="_blank" rel="noreferrer">
                    <img src={post.attachment.url} alt={post.attachment.name} loading="lazy" />
                  </a>
                ) : null}

                <div className="cc-board-comments">
                  {post.comments.map((comment) => (
                    <div className="cc-board-comment" key={comment.id}>
                      <div className="cc-board-comment-main">
                        <strong>{authorName(comment.author)}</strong>
                        {comment.body ? <span>{comment.body}</span> : null}
                        {comment.attachment ? (
                          <a className="cc-board-img small" href={comment.attachment.url} target="_blank" rel="noreferrer">
                            <img src={comment.attachment.url} alt={comment.attachment.name} loading="lazy" />
                          </a>
                        ) : null}
                        <time>{formatDate(comment.createdAt)}</time>
                      </div>
                      {isAdmin ? <button className="cc-board-del small" type="button" onClick={() => removeComment(post.id, comment.id)}>삭제</button> : null}
                    </div>
                  ))}

                  {viewer ? (
                    <form className="cc-board-comment-form" onSubmit={(event) => submitComment(post.id, event)}>
                      <input name="body" placeholder="댓글 달기" />
                      <label className="dm-attach-icon" title="이미지 첨부">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3 3 0 0 1 4.24 4.24l-9.19 9.19a1 1 0 0 1-1.42-1.42l8.49-8.48" /></svg>
                        <input type="file" name="file" accept="image/*" hidden onChange={(event) => setCommentImageName((current) => ({ ...current, [post.id]: event.target.files?.[0]?.name || "" }))} />
                      </label>
                      <button type="submit" disabled={busyComment === post.id}>{busyComment === post.id ? "…" : "등록"}</button>
                      {commentImageName[post.id] ? <span className="cc-board-comment-file">{commentImageName[post.id]}</span> : null}
                    </form>
                  ) : null}
                </div>
              </article>
            ))
          ) : (
            <p className="cc-empty">아직 글이 없어요. 첫 글을 남겨보세요 🌱</p>
          )}
        </div>
      </section>
    </main>
  );
}
