// Replay only reads: a lost connection during a write can have an unknown outcome.
const transientConnections=new Set(['CONNECTION_CLOSED','CONNECTION_ENDED','CONNECTION_DESTROYED','CONNECT_TIMEOUT','ECONNRESET','EPIPE']);
export async function withReadRetry(method,operation){
  for(let attempt=0;;attempt++){
    try{return await operation()}
    catch(error){
      if(method!=='GET'||attempt>=1||!transientConnections.has(error.code))throw error;
    }
  }
}
