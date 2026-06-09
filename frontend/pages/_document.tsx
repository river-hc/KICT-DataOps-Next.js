import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  const theme = process.env.NEXT_PUBLIC_THEME ?? 'default';
  return (
    <Html lang="ko">
      <Head />
      <body data-theme={theme}>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
