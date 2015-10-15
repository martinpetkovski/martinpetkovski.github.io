#include<iostream>
#include"util\util.h"
using namespace std;

int euclid_nzd_recursive(int m, int n)
{
	if (n == 0)
		return m;
	else
		return euclid_nzd_recursive(n, m % n);
}

int euclid_nzd_iterative(int m, int n)
{
	int temp = 0;
	if (m < n)
		swap(m, n);
	while (n != 0)
	{
		temp = m % n;
		m = n;
		n = temp;
	}
	return m;
}