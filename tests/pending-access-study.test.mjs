import test from'node:test';
import assert from'node:assert/strict';
import{samePublisherPost}from'../scripts/study-pending-access.mjs';
test('rota pública exige o mesmo artigo, publicação aberta e corpo suficiente',()=>{
 const url='https://fonte.org/noticia/123/consorcio/',post={link:url,status:'publish',type:'post',content:{rendered:'<p>O consórcio realizou uma reunião documentada com representantes municipais. O texto integral descreve a pauta e as providências efetivamente discutidas.</p>'}};
 assert.ok(samePublisherPost(post,url));
 assert.equal(samePublisherPost({...post,link:'https://outra.org/noticia/123/consorcio/'},url),null);
 assert.equal(samePublisherPost({...post,content:{...post.content,protected:true}},url),null);
 assert.equal(samePublisherPost({...post,status:'draft'},url),null);
 assert.equal(samePublisherPost({...post,content:{rendered:'Somente o título'}},url),null);
});
