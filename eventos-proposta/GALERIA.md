# Incluir fotografias

1. Coloque a foto em `eventos-proposta/assets/`, preferencialmente JPG ou WebP otimizado.
2. Abra `eventos-proposta/gallery-data.js`.
3. Copie um item da lista e preencha:

```js
{
  "src": "assets/nova-foto.jpg",
  "alt": "Descrição do que aparece na fotografia",
  "event": "Nome do evento"
}
```

A ordem da lista define a ordem das fotos. Moldura, tamanho, repetição infinita e visualizador são automáticos. Remova um item para retirar uma foto. Não duplique imagens manualmente para criar o loop.

O movimento oferece um botão para pausar o movimento, pausa quando o visualizador está aberto e pode ser pausado pelo botão da galeria.
