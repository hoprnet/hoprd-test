declare module 'k6/x/udp' {

    export interface Connection {

        localAddr(): string;
        remoteAddr(): string;

 }

    export function connect(remoteAddress: string): Connection;

    export function connectLocalAddress(remoteAddress: string, localAddress: string, timeout: number): Connection;

    export function writeLn(conn: Connection, data: ArrayBuffer): void;

    export function write(conn: Connection, data: ArrayBuffer): void;

    export function read(conn: Connection, size: number): ArrayBuffer;

    export function close(conn: Connection): void;

}