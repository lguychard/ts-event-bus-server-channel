import { GenericChannel, TransportMessage } from 'ts-event-bus'
import * as express from 'express'
import * as bodyParser from 'body-parser'

export interface HTTPServerChannelOptions {
    port: number,
    static?: {
        prefix?: string,
        folder: string
    }
}

export default class HTTPServerChannel extends GenericChannel {

    private _requests: { [requestId: string]: (message: TransportMessage) => void } = {}
    private _server = express()
    private _handlerRegisteredMessages: any[] = []
    private _router = express.Router()

    constructor(private _config: HTTPServerChannelOptions) {
        super()
        this._connected()
        this._setupRoutes()
        this._server.use(bodyParser.json())
        this._server.use(this._router)
        if (this._config.static) {
            const { prefix, folder } = this._config.static
            if (prefix) {
                this._server.use(prefix, express.static(folder))
            } else {
                this._server.use(express.static(folder))
            }
        }
        this._server.listen(this._config.port)
    }

    public send(message: TransportMessage): void {
        switch (message.type) {
            case 'handler_registered':
                this._handlerRegisteredMessages.push(message)
                break
            case 'error':
            case 'response':
                if (!this._requests[message.id]) {
                    throw new Error(`No pending request with id ${message.id}`)
                }
                this._requests[message.id](message)
                delete this._requests[message.id]
                break
            case 'request':
                throw new Error(`Cannot send requests from HTTPServerChannel`)
            default:
                throw new Error(`Should not happen: ${message}`)
        }
    }

    private _setupRoutes(): void {

        this._router.get('/handshake', (_, res) => {
            res.json(this._handlerRegisteredMessages)
        })

        this._router.post('/message', (req, res) => {
            this._requests[req.body.id] = (message: TransportMessage) => res.json(message)
            this._messageReceived(req.body)
        })

    }

}