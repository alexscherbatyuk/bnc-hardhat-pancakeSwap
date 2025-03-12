// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IPancakeRouter02.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract PancakeSwap is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IPancakeRouter02 public immutable router;
    address public immutable WBNB;

    event TokensPurchased(address indexed buyer, address token, uint amountSpent, uint amountReceived);
    event LiquidityAdded(address indexed provider, address token, uint tokenAmount, uint bnbAmount);

    constructor(address _router, address _WBNB) {
        require(_router != address(0), "Invalid router address");
        require(_WBNB != address(0), "Invalid WBNB address");

        router = IPancakeRouter02(_router);
        WBNB = _WBNB;
    }

    function buyAndAddLiquidity(
        address token,
        uint amountOut,
        uint addBNB,
        address to,
        uint deadline,
        uint amountTokenMin,
        uint amountETHMin
    ) external payable nonReentrant {
        require(token != address(0), "Invalid token address");
        require(msg.value >= addBNB, "Insufficient BNB sent");

        address[] memory path = new address[](2);
        path[0] = WBNB;
        path[1] = token;

        uint[] memory amounts = router.getAmountsIn(amountOut, path);
        uint amountIn = amounts[0];

        require(msg.value >= amountIn + addBNB, "Insufficient BNB for swap and liquidity");

        uint[] memory receivedAmounts = router.swapETHForExactTokens{value: amountIn}(amountOut, path, address(this), deadline);
        uint tokensReceived = receivedAmounts[1];

        emit TokensPurchased(msg.sender, token, amountIn, tokensReceived);

        SafeERC20.safeIncreaseAllowance(IERC20(token), address(router), tokensReceived);

        (, uint ethUsed, ) = router.addLiquidityETH{value: addBNB}(
            token,
            tokensReceived, 
            amountTokenMin,
            amountETHMin,
            to,
            deadline
        );

        emit LiquidityAdded(to, token, tokensReceived, ethUsed);

        uint refund = msg.value - amountIn - addBNB;
        if (refund > 0) {
            payable(msg.sender).transfer(refund);
        }
    }

    receive() external payable {}
}
