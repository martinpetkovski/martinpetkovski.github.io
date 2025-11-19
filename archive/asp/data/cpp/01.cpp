#include<iostream>
using namespace std;

bool pechati_parni_broevi_recursive(int min, int max)
{
	cout << min << " ";
	if (min == max)
		return true;
	else
		pechati_parni_broevi_recursive(min + 2, max);
}

void pechati_parni_broevi_iterative(int min, int max)
{
	for (int i = min; i < max; i += 2)
		cout << i << " ";
}