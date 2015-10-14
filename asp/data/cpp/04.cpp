#include<iostream>
#include"util\util.h"
using namespace std;

dword fibonachi_recursive(dword n)
{
	if (n == 0)
		return 0;
	if (n == 1)
		return 1;
	return fibonachi_recursive(n - 1) + fibonachi_recursive(n - 2);
}

dword fibonachi_iterative(dword n)
{
	dword a = 0, b = 1, c = 1;
	for (dword i = 0; i < n; i++)
	{
		a = b;
		b = c;
		c = a + b;
	}
	return a;
}