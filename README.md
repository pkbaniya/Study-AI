# StudiAI

AI-powered studying: personalized plans, practice tests, flashcards, and a tutor.

## Development

```sh
npm i
npm run dev
```

The app runs at http://localhost:8081 when port 8080 is already taken.

Set `GEMINI_API_KEY` in `.env` before using study tools. Google sign-in uses the Supabase project in `.env` and needs a Google OAuth client configured in that project's Auth settings.

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
- Supabase
- Gemini
