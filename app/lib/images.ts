// Las fotos viven en Cloudinary y su direccion guarda el ancho pedido
// ("f_auto,q_auto,c_limit,w_1400"). Todas se guardaron a 1400 px y se muestran a
// unos 340, asi que cada foto bajaba tres veces mas de lo necesario: ~11,8 MB el
// menu entero frente a ~3,8 MB a 720 px, medido con fotos reales.
//
// En vez de tocar la base de datos o resubir nada, aqui se reescribe el ancho en
// la propia direccion segun donde se vaya a pintar la foto.

// Despues de /upload/ puede haber cero o mas segmentos de transformacion; la
// version (v123...) marca donde empieza el nombre real del fichero.
const CLOUDINARY = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(?:(?!v\d+\/)[^/]+\/)*(v\d+\/.+)$/;

/** La misma foto pedida a un ancho concreto. Cualquier otra direccion se devuelve tal cual. */
export function photoUrl(url: string, width: number) {
  const partes = CLOUDINARY.exec(url);
  if (!partes) return url;
  // c_limit nunca amplia: si la original es mas pequena, se sirve como esta.
  return `${partes[1]}f_auto,q_auto,c_limit,w_${Math.round(width)}/${partes[2]}`;
}

/** srcset con varios anchos, para que cada movil se descargue el que le toca. Sin Cloudinary: nada. */
export function photoSrcSet(url: string, widths: number[]) {
  if (!CLOUDINARY.test(url)) return undefined;
  return widths.map((width) => `${photoUrl(url, width)} ${Math.round(width)}w`).join(", ");
}
