<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the product as a session-aware single workspace at `/`; this matches the reference’s auth-to-dashboard flow and avoids duplicate home routes.
- Store durable coursework in Supabase, while guest sessions remain browser-local and disposable.
- Brand the product as StudiAI with an original teal-and-coral identity; this avoids copying StudiQ's protected branding.
