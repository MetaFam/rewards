import { Html, Head, Main, NextScript } from 'next/document'
import { useGAPI } from '../lib/useGAPI'

export const Document = () => {
  const { initGAPI, initGSI } = useGAPI() 

  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <script
          async defer
          src="https://apis.google.com/js/api.js"
          onLoad={initGAPI}
        ></script>
        <script
          async defer
          src="https://accounts.google.com/gsi/client"
          onLoad={initGSI}
        ></script>
        <NextScript />
      </body>
    </Html>
  )
}

export default Document