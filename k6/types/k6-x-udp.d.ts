declare module 'k6/x/udp' {

    export interface Connection { }

    export function connect(address: string): Connection;

    export function writeLn(conn: Connection, data: ArrayBuffer): void;

    export function write(conn: Connection, data: ArrayBuffer): void;

    export function read(conn: Connection, size: number): ArrayBuffer;

    export function close(conn: Connection): void;

}