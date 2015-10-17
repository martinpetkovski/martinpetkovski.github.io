#include<iostream>
using namespace std;

int sekvencijalno_prebaruvanje(int niza[], int n, int kluch)
{
	for (int i = 0; i < n; i++)
		if (niza[i] == kluch)
			return i;
	return -1;
}