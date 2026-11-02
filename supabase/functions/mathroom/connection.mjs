// Edge isolates may outlive their sockets. Never share a database pool across requests.
export async function withConnection(create,handle){
  const sql=create();
  try{return await handle(sql)}
  finally{try{await sql.end({timeout:2})}catch{console.error('database_connection_close_failed')}}
}
