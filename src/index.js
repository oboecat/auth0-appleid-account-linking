import http from 'http';
import { app } from "./app";

const {
    HOSTNAME = process.env.HOST || process.env.HOSTNAME || '0.0.0.0', 
    PORT     = process.env.PORT || 3000
} = process.env;

function upNotifier() {
    console.log(`Server up and running on ${HOSTNAME}:${PORT}`);
}

const server = http.createServer(app);
server.listen(PORT, HOSTNAME, upNotifier);