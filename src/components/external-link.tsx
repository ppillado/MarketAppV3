import { Href, Link } from 'expo-router';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { type ComponentProps } from 'react';

type Props = Omit<ComponentProps<typeof Link>, 'href'> & { href: Href & string };

export function ExternalLink({ href, ...rest }: Props) {
  return (
    <Link
      target="_blank"
      {...rest}
      href={href}
      onPress={async (event) => {
        if (process.env.EXPO_OS !== 'web') {
          // Evita el comportamiento por defecto en el celular, que abre el navegador del sistema.
          event.preventDefault();
          // Abre el enlace en un navegador dentro de la app.
          await openBrowserAsync(href, {
            presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
          });
        }
      }}
    />
  );
}
