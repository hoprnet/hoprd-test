from ...target_environment.target_environment import TargetEnvironment
from ...target_environment.anvil_env_manager import AnvilEnvironmentManager
from ...api_object_model.account.account import Account
from ...api_object_model.account.address import Address
import pytest
from typing import List
import time

"""
Send Messages Test Plan Implementation.
"""

def test_case1():
    """ """
    local_env = AnvilEnvironmentManager()
    local_env.setup_local_nodes(5)
    time.sleep(30)
    account = Account()
    hoprAddress = account.get_address(1, Address.HOPR)
    assert '0x' in hoprAddress

    time.sleep(10000)