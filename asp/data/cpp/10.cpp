#include<iostream>
using namespace std;


int zbir_na_cifri(int n)
{
	int zbir = 0;
	while (n > 0)
	{
		zbir += n % 10;
		n /= 10;
	}

	return zbir;
}