import os, sys
import shutil
import binascii
import random
import socket
import string
import subprocess
from typing import List
import time


# from ..topologies.node import Node
class Node(object):
    """
    Node model.
    """

    def __init__(self, p2p_port: int, api_port: int, private_key: str, peer_id: str) -> None:
        self.p2p_port = p2p_port
        self.api_port = api_port
        self.private_key = private_key
        self.peer_id = peer_id


class AnvilEnvironmentManager:
    HOST = "127.0.0.1"
    P2P_PORT_BASE = 19090
    API_PORT_BASE = 13300
    ANVIL_PORT = 8545

    DEBUG = "hopr*"
    NODE_ENV = "development"
    HOPRD_HEARTBEAT_INTERVAL = 2500
    HOPRD_HEARTBEAT_THRESHOLD = 2500
    HOPRD_HEARTBEAT_VARIANCE = 1000
    HOPRD_NETWORK_QUALITY_THRESHOLD = 0.3
    HOPRD_ON_CHAIN_CONFIRMATIONS = 2

    PASSWORD = "e2e-test"
    HOPRD_PASSWORD = "open-sesame-iTwnsPNg0hpagP+o6T0KOwiH9RQ0"
    HOPRD_API_TOKEN = "^binary6wire6GLEEMAN9urbanebetween1watch^"
    DEFAULT_API_TOKEN = "e2e-API-token^^"

    tmp = "/tmp"
    password = "e2e-test"

    def __init__(self) -> None:
        self.cleanup()
        self.env_vars = os.environ.copy()

        self.__set_envar("ADDITIONAL_NODE_ADDRS", "0xde913eeed23bce5274ead3de8c196a41176fbd49")
        self.__set_envar("ADDITIONAL_NODE_PEERIDS", "16Uiu2HAm2VD6owCxPEZwP6Moe1jzapqziVeaTXf1h7jVzu5dW1mk")
        self.__set_envar("HOPRD_API_TOKEN", self.DEFAULT_API_TOKEN)
        self.__set_envar("PRIVATE_KEY", "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")
        self.__set_envar("DEPLOYER_PRIVATE_KEY", "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")
        self.__set_envar("ETHERSCAN_API_KEY", "")
        self.__set_envar("NETWORK", "anvil-localhost")
        self.__set_envar("FOUNDRY_PROFILE", "local")
        self.__set_envar("IDENTITY_PASSWORD", self.PASSWORD)

        self.__set_envar("DEBUG", self.DEBUG)
        self.__set_envar("NODE_ENV", self.NODE_ENV)
        self.__set_envar("HOPRD_HEARTBEAT_INTERVAL", str(self.HOPRD_HEARTBEAT_INTERVAL))
        self.__set_envar("HOPRD_HEARTBEAT_THRESHOLD", str(self.HOPRD_HEARTBEAT_THRESHOLD))
        self.__set_envar("HOPRD_HEARTBEAT_VARIANCE", str(self.HOPRD_HEARTBEAT_VARIANCE))
        self.__set_envar("HOPRD_NETWORK_QUALITY_THRESHOLD", str(self.HOPRD_NETWORK_QUALITY_THRESHOLD))
        self.__set_envar("HOPRD_ON_CHAIN_CONFIRMATIONS", str(self.HOPRD_ON_CHAIN_CONFIRMATIONS))

    def __del__(self) -> None:
        self.cleanup()

    def setup_local_nodes(self, count) -> List[Node]:
        """
        Setting up a number of local nodes
        :count: The number of local nodes to setup
        """
        print("setup_local_nodes " + str(count))
        for port in range(1, count + 1):
            self.__ensure_port_is_free(port)
        self.__ensure_port_is_free(self.ANVIL_PORT)
        self.run_local_anvil()
        self.deploy_contracts()
        #self.update_protocol_config_addresses()
        nodes = self.generate_nodes(count)

        for index, node in enumerate(nodes):
            self.setup_node(index + 1, node)
        # self.fund_nodes()
        return nodes

    def run_local_anvil(self):
        """
        Starting the local anvil chain
        """
        print("run_local_anvil", file=sys.stdout)
        if self.__port_in_use(self.ANVIL_PORT):
            print("Anvil chain already running, skipping...", file=sys.stdout)
        else:
            print("Start local anvil chain...", file=sys.stdout)
            command = ["anvil", "--host", self.HOST, "--block-time", "2", "--config-out", ".anvil.cfg"]
            self.anvil_process = subprocess.Popen(command, shell=True, stdout=subprocess.PIPE)
            time.sleep(10)
            """
            while True:
                for line in self.anvil_process.stdout:
                    line_decoded = line.decode("utf-8")
                    print(line_decoded, file=sys.stdout)
                    if f"Listening on {self.HOST}:{self.ANVIL_PORT}" in line_decoded:
                        print(f"Anvil chain started successfully @({self.HOST}:{self.ANVIL_PORT})", file=sys.stdout)
                        print(f"Anvil chain started successfully @({self.HOST}:{self.ANVIL_PORT})")
                        break
                else:
                    print("Continue...", file=sys.stdout)
                    continue
                break
            """

    def deploy_contracts(self):
        """ """
        # command = ["make", "-C", "packages/ethereum/contracts/ anvil-deploy-all"]
        command1 = ["cast", "code", "0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24"]
        command2 = [
            "cast",
            "send",
            "0xa990077c3205cbDf861e17Fa532eeB069cE9fF96",
            "--value",
            "0.8ether",
            "--private-key",
            "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        ]
        command3 = [
            "cast",
            "publish",
            "0xf90a388085174876e800830c35008080b909e560806040523480156100105760008"
            + "0fd5b506109c5806100206000396000f3fe608060405234801561001057600080fd5b"
            + "50600436106100a5576000357c0100000000000000000000000000000000000000000"
            + "00000000000000090048063a41e7d5111610078578063a41e7d51146101d4578063aa"
            + "bbb8ca1461020a578063b705676514610236578063f712f3e814610280576100a5565"
            + "b806329965a1d146100aa5780633d584063146100e25780635df8122f146101245780"
            + "6365ba36c114610152575b600080fd5b6100e0600480360360608110156100c057600"
            + "080fd5b50600160a060020a038135811691602081013591604090910135166102b656"
            + "5b005b610108600480360360208110156100f857600080fd5b5035600160a060020a0"
            + "316610570565b60408051600160a060020a039092168252519081900360200190f35b"
            + "6100e06004803603604081101561013a57600080fd5b50600160a060020a038135811"
            + "69160200135166105bc565b6101c26004803603602081101561016857600080fd5b81"
            + "019060208101813564010000000081111561018357600080fd5b82018360208201111"
            + "561019557600080fd5b80359060200191846001830284011164010000000083111715"
            + "6101b757600080fd5b5090925090506106b3565b60408051918252519081900360200"
            + "190f35b6100e0600480360360408110156101ea57600080fd5b508035600160a06002"
            + "0a03169060200135600160e060020a0319166106ee565b61010860048036036040811"
            + "01561022057600080fd5b50600160a060020a038135169060200135610778565b6102"
            + "6c6004803603604081101561024c57600080fd5b508035600160a060020a031690602"
            + "00135600160e060020a0319166107ef565b6040805191151582525190819003602001"
            + "90f35b61026c6004803603604081101561029657600080fd5b508035600160a060020"
            + "a03169060200135600160e060020a0319166108aa565b6000600160a060020a038416"
            + "156102cd57836102cf565b335b9050336102db82610570565b600160a060020a03161"
            + "4610339576040805160e560020a62461bcd02815260206004820152600f6024820152"
            + "7f4e6f7420746865206d616e616765720000000000000000000000000000000000604"
            + "482015290519081900360640190fd5b6103428361092a565b15610397576040805160"
            + "e560020a62461bcd02815260206004820152601a60248201527f4d757374206e6f742"
            + "0626520616e2045524331363520686173680000000000006044820152905190819003"
            + "60640190fd5b600160a060020a038216158015906103b85750600160a060020a03821"
            + "63314155b156104ff5760405160200180807f455243313832305f4143434550545f4d"
            + "414749430000000000000000000000008152506014019050604051602081830303815"
            + "2906040528051906020012082600160a060020a031663249cb3fa85846040518363ff"
            + "ffffff167c01000000000000000000000000000000000000000000000000000000000"
            + "281526004018083815260200182600160a060020a0316600160a060020a0316815260"
            + "20019250505060206040518083038186803b15801561047e57600080fd5b505afa158"
            + "015610492573d6000803e3d6000fd5b505050506040513d60208110156104a8576000"
            + "80fd5b5051146104ff576040805160e560020a62461bcd02815260206004820181905"
            + "260248201527f446f6573206e6f7420696d706c656d656e742074686520696e746572"
            + "66616365604482015290519081900360640190fd5b600160a060020a0381811660008"
            + "1815260208181526040808320888452909152808220805473ffffffffffffffffffff"
            + "ffffffffffffffffffff19169487169485179055518692917f93baa6efbd2244243bf"
            + "ee6ce4cfdd1d04fc4c0e9a786abd3a41313bd352db15391a450505050565b600160a0"
            + "60020a03818116600090815260016020526040812054909116151561059a575080610"
            + "5b7565b50600160a060020a03808216600090815260016020526040902054165b9190"
            + "50565b336105c683610570565b600160a060020a031614610624576040805160e5600"
            + "20a62461bcd02815260206004820152600f60248201527f4e6f7420746865206d616e"
            + "616765720000000000000000000000000000000000604482015290519081900360640"
            + "190fd5b81600160a060020a031681600160a060020a0316146106435780610646565b"
            + "60005b600160a060020a03838116600081815260016020526040808220805473fffff"
            + "fffffffffffffffffffffffffffffffffff1916958516959095179094559251918416"
            + "9290917f605c2dbf762e5f7d60a546d42e7205dcb1b011ebc62a61736a57c9089d3a4"
            + "3509190a35050565b6000828260405160200180838380828437808301925050509250"
            + "50506040516020818303038152906040528051906020012090505b92915050565b610"
            + "6f882826107ef565b610703576000610705565b815b600160a060020a039283166000"
            + "81815260208181526040808320600160e060020a03199690961680845295825280832"
            + "0805473ffffffffffffffffffffffffffffffffffffffff1916959097169490941790"
            + "9555908152600284528181209281529190925220805460ff19166001179055565b600"
            + "080600160a060020a038416156107905783610792565b335b905061079d8361092a56"
            + "5b156107c357826107ad82826108aa565b6107b85760006107ba565b815b925050506"
            + "106e8565b600160a060020a0390811660009081526020818152604080832086845290"
            + "915290205416905092915050565b6000808061081d857f01ffc9a7000000000000000"
            + "0000000000000000000000000000000000000000061094c565b909250905081158061"
            + "082d575080155b1561083d576000925050506106e8565b61084f85600160e060020a0"
            + "31961094c565b909250905081158061086057508015155b1561087057600092505050"
            + "6106e8565b61087a858561094c565b909250905060018214801561088f57508060011"
            + "45b1561089f576001925050506106e8565b506000949350505050565b600160a06002"
            + "0a0382166000908152600260209081526040808320600160e060020a0319851684529"
            + "0915281205460ff1615156108f2576108eb83836107ef565b90506106e8565b506001"
            + "60a060020a03808316600081815260208181526040808320600160e060020a0319871"
            + "684529091529020549091161492915050565b7bffffffffffffffffffffffffffffff"
            + "ffffffffffffffffffffffffff161590565b6040517f01ffc9a700000000000000000"
            + "000000000000000000000000000000000000000808252600482018390526000918291"
            + "9060208160248189617530fa90519096909550935050505056fea165627a7a7230582"
            + "0377f4a2d4301ede9949f163f319021a6e9c687c292a5e2b2c4734c126b524e6c0029"
            + "1ba01820182018201820182018201820182018201820182018201820182018201820a"
            + "01820182018201820182018201820182018201820182018201820182018201820",
        ]
        command4 = [
            "time",
            "forge",
            "script",
            "--broadcast",
            "script/DeployAll.s.sol:DeployAllContractsScript",
        ]
        print("Executing command: " + str(command1))
        self.deploy_contracts_process = subprocess.run(command1)
        print("Executing command: " + str(command2))
        self.deploy_contracts_process = subprocess.run(command2)
        print("Executing command: " + str(command3))
        self.deploy_contracts_process = subprocess.run(command3)
        print("Executing command: " + str(command4))
        self.deploy_contracts_process = subprocess.run(command4, cwd="/home/runner/work/hopraf/hopraf/hoprnet/packages/ethereum/contracts")

    def update_protocol_config_addresses(self):
        """
        Updating contract addresses in protocol configuration
        """
        """
        source_network = "anvil-localhost"
        source_file = "packages/ethereum/contracts/contracts-addresses.json"
        command1 = ["jq", "-r", f'.networks."{source_network}"', f"{source_file}"]
        command2 = [
            "jq",
            "{environment_type: .environment_type, indexer_start_block_number: .indexer_start_block_number, token_contract_address: .token_contract_address, channels_contract_address: .channels_contract_address, xhopr_contract_address: .xhopr_contract_address, boost_contract_address: .boost_contract_address, stake_contract_address: .stake_contract_address, network_registry_proxy_contract_address: .network_registry_proxy_contract_address, network_registry_contract_address: .network_registry_contract_address})",
        ]
        self.update_protocol_addresses = subprocess.Popen(command1, shell=True, stdout=subprocess.PIPE)
        self.update_protocol_addresses.wait()
        self.update_protocol_addresses = subprocess.Popen(command2, shell=True, stdout=subprocess.PIPE)
        self.update_protocol_addresses.wait()
        """
        command = ["./utils.sh"]
        self.update_protocol_addresses = subprocess.run(command, cwd="packages/ethereum/contracts")

    def stop_local_anvil(self):
        """
        Stopping the execution of the local anvil process (for cleanup purposes)
        Prerequisite: The anvil process has to be already running
        """
        print("Kill local anvil chain...")
        if self.__port_in_use(self.ANVIL_PORT):
            try:
                self.anvil_process.kill()
                # sudo kill -9 `sudo lsof -t -i:8545`
            except AttributeError:
                pass

    def setup_node(self, nodeIndex: int, node: Node) -> None:
        """
        Setting up and running a node with given parameters.
        :nodeIndex: The index of the node.
        :node: The node configuration
        """
        print("node: " + str(node.api_port) + " " + str(node.p2p_port) + " " + node.peer_id + " " + node.private_key, file=sys.stdout)
        dir = f"test-node-{nodeIndex}"
        dir_id = f"test-node-{nodeIndex}.id"
        if not os.path.isdir(dir):
            os.mkdir(dir)
        if not os.path.isdir(dir_id):
            os.mkdir(dir_id)

        id = "".join([dir, ".id"])
        "".join([dir, ".log"])
        command = [
            "node",
            "--experimental-wasm-modules",
            "--experimental-wasm-reftypes",
            "/home/runner/work/hopraf/hopraf/hoprnet/packages/hoprd/lib/main.cjs",
            f'--data="{dir}"',
            f"--host={self.HOST}:{node.p2p_port}",
            f'--identity="{id}"',
            "--init",
            f"--password={self.password}",
            "--privateKey=0x1f5b172a64947589be6e279fbcbc09aca6e623a64a92aa359fae9c6613b7e801",
            "--api",
            "--apiPort",
            f"{node.api_port}",
            "--testAnnounceLocalAddresses",
            "--testPreferLocalAddresses",
            "--testUseWeakCrypto",
            "--allowLocalNodeConnections",
            "--allowPrivateNodeConnections",
            "--network",
            "anvil-localhost",
            "--api-token",
            f"{self.DEFAULT_API_TOKEN}",
            "--announce",
        ]
        # print(command)
        # self.node_process = subprocess.run(command)
        # log = open("log.txt", "w")
        #self.node_process = subprocess.run(command)
        self.node_process = subprocess.Popen(command, stdout=subprocess.PIPE, universal_newlines=True)
        for stdout_line in iter(self.node_process.stdout.readline, ""):
            yield stdout_line 
        self.node_process.stdout.close()
        return_code = self.node_process.wait()
        if return_code:
            raise subprocess.CalledProcessError(return_code, command)

    def fund_nodes(self):
        """ """
        node_prefix = "hopr-smoke-test-node"
        command = [
            "make",
            "-C",
            "fund-local-all",
            f"id_password={password}",
            f"id_prefix={node_prefix}",
            f"id_dir=./tmp",
        ]
        # self.funding_nodes = subprocess.Popen(command)
        print("==================== " + str(command))
        time.sleep(10)
        self.funding_nodes = subprocess.call(command)

    def generate_nodes(self, count) -> List[Node]:
        """
        Generating a list of nodes.
        :count: The number of nodes to generate
        """
        nodes = []
        for i in range(count):
            nodes.append(self.generate_node(i + 1))
        return nodes

    def generate_node(self, index) -> Node:
        """
        Generating a node
        :index: The node index to be used to building up the p2p and api ports
        :return: A node object
        """
        node: Node = Node(
            p2p_port=self.P2P_PORT_BASE + index,
            api_port=self.API_PORT_BASE + index,
            private_key=self.generate_private_key(),
            peer_id=self.generate_peer_id(),
        )
        return node

    def register_node(self) -> None:
        """
        Registering a node within the network.
        """
        pass

    def generate_private_key(self) -> str:
        """
        Generate 64-digit hexadecimal number.
        Example: 0xb0c01844be5d5deaf7514592be16594a05522ada5c0e22a24aa8a7ec7bc180b2
        :privateKey: The 64-byte random generated private key
        """
        hex: bytes = binascii.b2a_hex(os.urandom(32))
        privateKey: str = "0x" + hex.decode("utf-8")
        return privateKey

    def generate_peer_id(self) -> str:
        """
        Generate 53-digit peer id with random lower and capital case ascii letters and digits, starting with '16U'
        Example: 16ULoTSioYpLX0Bwqh1LD4YAsm2uSnwgyhSKMY9RRXNKwzKIsXKBv
        :return: 53-digit peer id starting with '16U'
        """
        string50 = "".join(random.choices(string.ascii_letters + string.digits, k=50))
        peerId = "16U" + string50
        return peerId

    def cleanup(self) -> None:
        """
        Cleanup node directories, etc
        """
        self.stop_local_anvil()
        files = os.listdir(".")
        for file in files:
            if "test-node" in file:
                if os.path.isdir(file):
                    shutil.rmtree(file, ignore_errors=True)
                if os.path.isfile(file):
                    os.remove(file)

    def __ensure_port_is_free(self, port):
        """ """
        if self.__port_in_use(port):
            raise Exception(f"Port {port} is in use")

    def __port_in_use(self, port):
        """
        Check if a given port is in use.
        :port: The port to check against localhost.
        """
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        result = sock.connect_ex((self.HOST, port))
        if result == 0:
            return True
        else:
            return False

    def __set_envar(self, name: str, value: str):
        """
        Generic helper method used to set an environment variable within the OS
        """
        os.environ.setdefault(name, value)
